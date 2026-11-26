import {timingSafeEqual} from 'node:crypto';
import {parseSupplierCsv,seasonForDate} from '../../../winkel/persoonlijke-noot/supplierCsv';
import {dateOnly,text} from '../../../winkel/persoonlijke-noot/model';
import {importMailOrders,PickupError} from '../../../winkel/persoonlijke-noot/server';
import {writeImportStatus} from '../../../winkel/persoonlijke-noot/importStatus';
import type {Json} from '../../../lib/supabase/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
function authorized(request:Request) {
  const expected=process.env.BAKERY_LOGISTICS_IMPORT_KEY||process.env.LOGISTICS_IMPORT_KEY||process.env.WORDPRESS_STRIK_API_KEY||'';
  const supplied=request.headers.get('x-strik-logistics-key')||'';
  return !!expected&&Buffer.byteLength(expected)===Buffer.byteLength(supplied)&&timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
}
export async function POST(request:Request) {
  if(!authorized(request))return json({message:'Geen toegang tot de mailimport.'},403);
  try {
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({message:'Verstuur een CSV-bestand via de mailimport.'},415);
    if(Number(request.headers.get('content-length')||0)>2_200_000)return json({message:'CSV maximaal 2 MB.'},413);
    const raw=await request.text();if(Buffer.byteLength(raw)>2_200_000)return json({message:'CSV maximaal 2 MB.'},413);
    const body=JSON.parse(raw),at=new Date().toISOString();
    if(body.action==='check') {await writeImportStatus({enabled:true,lastCheck:at,waitingLinks:Math.min(Math.max(Number(body.waitingLinks)||0,0),1000)});return json({ok:true});}
    const orderDate=dateOnly(body.orderDate);if(!orderDate)throw Error('Besteldatum ontbreekt.');
    const sourceName=text(body.sourceName,200),edition=seasonForDate(orderDate);
    if(typeof body.csv!=='string')throw Error('CSV-inhoud ontbreekt.');
    const parsed=parseSupplierCsv(body.csv,{edition,orderDate,sourceName});
    if(parsed.errors.length)return json({message:parsed.errors.join(' '),errors:parsed.errors},422);
    // Examples are always a dry run, including when the sender forgot to flag one.
    if(body.dryRun===true||parsed.sample) {
      const preview=parsed.orders.map(o=>({name:o.name,product:o.product,quantity:o.quantity,store:o.store,pickupDate:o.pickupDate,unitPriceEx:o.unitPriceEx}));
      if(parsed.sample)await writeImportStatus({lastTest:at,testRows:preview as Json,testPassed:true});
      return json({ok:true,complete:true,dryRun:true,sample:parsed.sample,edition,preview,warnings:parsed.warnings,added:0});
    }
    const result=await importMailOrders(parsed.orders,sourceName);
    await writeImportStatus({lastImport:at,lastAdded:result.added,lastUnchanged:result.unchanged,lastConflicts:result.conflicts.length});
    return json({ok:true,complete:result.conflicts.length===0,...result,warnings:parsed.warnings});
  }catch(e){return json({message:e instanceof Error?e.message:'Importeren mislukt.'},e instanceof PickupError?e.status:400);}
}
