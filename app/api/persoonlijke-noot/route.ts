import { getCurrentProfile } from '../../lib/auth/session';
import { hasFullAccess } from '../../lib/auth/access';
import { canViewNo, canManageNo, allowedNoStores } from '../../winkel/persoonlijke-noot/access';
import { localDate } from '../../winkel/persoonlijke-noot/model';
import { importOrders, readOrders, updateOrder, markInvoice, PickupError } from '../../winkel/persoonlijke-noot/server';
import { readImportStatus } from '../../winkel/persoonlijke-noot/importStatus';
import { seasonForDate } from '../../winkel/persoonlijke-noot/supplierCsv';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
export async function GET(request:Request) {
  const profile=await getCurrentProfile();if(!profile || !canViewNo(profile)) return json({message:'Geen toegang tot deze afhaallijst.'},403);
  try {const edition=new URL(request.url).searchParams.get('year') || seasonForDate(localDate());const [orders,automaticImport]=await Promise.all([readOrders(profile,edition),canManageNo(profile)?readImportStatus():null]);return json({orders,stores:allowedNoStores(profile),canManage:canManageNo(profile),canInvoice:hasFullAccess(profile),edition,automaticImport});}
  catch(e) {return json({message:e instanceof Error?e.message:'Laden is mislukt.'},e instanceof PickupError?e.status:503);}
}
export async function POST(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin || !request.headers.get('content-type')?.startsWith('application/json')) return json({message:'Open de afhaallijst opnieuw in de app.'},403);
  const profile=await getCurrentProfile();if(!profile || !canViewNo(profile)) return json({message:'Geen toegang tot deze afhaallijst.'},403);
  try {
    if(Number(request.headers.get('content-length')||0)>2_000_000) return json({message:'Import maximaal 2 MB.'},413);
    const raw=await request.text();if(raw.length>2_000_000) return json({message:'Import maximaal 2 MB.'},413);
    const body=JSON.parse(raw);
    if(!body || typeof body!=='object') throw new PickupError('Ongeldige wijziging.');
    if(body.action==='import') return json(await importOrders(profile,body.orders,body.sourceName));
    if(body.action==='invoice') return json({count:await markInvoice(profile,body)});
    await updateOrder(profile,body);return json({ok:true});
  } catch(e) {return json({message:e instanceof Error?e.message:'Opslaan is mislukt.'},e instanceof PickupError?e.status:400);}
}
