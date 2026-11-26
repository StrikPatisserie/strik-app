import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '../../lib/supabase/admin';
import type { Json, UserProfile } from '../../lib/supabase/types';
import { hasFullAccess } from '../../lib/auth/access';
import { allowedNoStores, canManageNo } from './access';
import { changePickup, identity, normalizeInput, sourceFields, text, type PickupOrder, type OrderInput } from './model';

export class PickupError extends Error { constructor(message:string, public status=400) { super(message); } }
const table = 'persoonlijke_noot_orders';
function unpack(row: {id:string;revision:number;data:Json}): PickupOrder { return {...(row.data as object),id:row.id,revision:row.revision} as PickupOrder; }
export function orderId(input: OrderInput) { return createHash('sha256').update(identity(input)).digest('hex'); }
export async function readOrders(profile: UserProfile, edition:string) {
  if (!/^20\d{2}$/.test(edition)) throw new PickupError('Kies een geldig seizoenjaar.');
  const db=createAdminClient(), orders:PickupOrder[]=[];
  for(let offset=0;;offset+=500) {
    let query=db.from(table).select('id,revision,data').eq('edition',edition).order('id').range(offset,offset+499);
    if (!canManageNo(profile)) query=query.in('store',allowedNoStores(profile));
    const {data,error}=await query;
    if(error) throw new PickupError('De afhaallijst kon niet worden geladen.',503);
    orders.push(...(data||[]).map(unpack)); if(!data || data.length<500) break;
  }
  return orders.map(o=>canManageNo(profile) ? o : {...o,unitPriceEx:null,invoiceNumber:o.invoiceNumber?'Geregistreerd':'',events:o.events.filter(e=>!['invoice','clear-invoice'].includes(e.action))});
}
export async function importOrders(profile: UserProfile, input:unknown, sourceName:string) {
  if(!canManageNo(profile)) throw new PickupError('Alleen management en logistiek kunnen importeren.',403);
  if(!Array.isArray(input) || !input.length || input.length>1000) throw new PickupError('Importeer 1 tot maximaal 1.000 regels tegelijk.');
  const orders=input.map(normalizeInput), seen=new Set<string>();
  for(const order of orders) { const id=orderId(order); if(seen.has(id)) throw new PickupError('Er staan dubbele bestelregels in deze import. Koppel het regelnummer.');seen.add(id); }
  const at=new Date().toISOString(),actor=profile.full_name || profile.email,db=createAdminClient();
  const prepared=orders.map(order=>({id:orderId(order),edition:order.edition,store:order.store,revision:1,data:{...order,importedAt:at,sourceName:text(sourceName),collectedAt:null,collectedBy:'',cancelled:false,invoiceNumber:'',invoicedAt:null,events:[{at,actor,action:'import'}]} as Json}));
  const {data:inserted,error}=await db.from(table).upsert(prepared,{onConflict:'id',ignoreDuplicates:true}).select('id');
  if(error) throw new PickupError('Opslaan is mislukt. De import kan veilig opnieuw worden geprobeerd.',503);
  const newIds=new Set(inserted?.map(o=>o.id)), conflicts:string[]=[];
  const existingIds=prepared.filter(p=>!newIds.has(p.id)).map(p=>p.id);
  // Read in batches so both URL length and PostgREST row limits remain bounded.
  for(let i=0;i<existingIds.length;i+=100) {
    const {data,error}=await db.from(table).select('id,revision,data').in('id',existingIds.slice(i,i+100));
    if(error) throw new PickupError('De import is opgeslagen, maar controle van bestaande regels is mislukt. Vernieuw de lijst en probeer opnieuw.',503);
    for(const row of data||[]) {const original=orders.find(o=>orderId(o)===row.id)!;if(sourceFields(original)!==sourceFields(unpack(row))) conflicts.push(`${original.orderNumber} · ${original.product}`);}
  }
  return {added:newIds.size,unchanged:orders.length-newIds.size-conflicts.length,conflicts};
}
export async function updateOrder(profile:UserProfile, body:Record<string,unknown>) {
  const id=text(body.id,64),revision=Number(body.revision),action=text(body.action);
  if(!/^[a-f0-9]{64}$/.test(id) || !Number.isSafeInteger(revision)) throw new PickupError('Open de bestelling opnieuw.');
  const db=createAdminClient();const {data:row,error}=await db.from(table).select('id,revision,data').eq('id',id).maybeSingle();
  if(error) throw new PickupError('De bestelling kon niet worden geladen.',503);
  if(!row) throw new PickupError('Bestelling niet gevonden.',404);
  const before=unpack(row);
  if(!canManageNo(profile) && !allowedNoStores(profile).includes(before.store)) throw new PickupError('Geen toegang tot deze winkel.',403);
  if(before.revision!==revision) throw new PickupError('Iemand heeft deze bestelling zojuist aangepast. Vernieuw de lijst.',409);
  const at=new Date().toISOString(),actor=profile.full_name||profile.email;
  let after:PickupOrder;
  if(['collect','undo'].includes(action)) after=changePickup(before,action as 'collect'|'undo',actor,at);
  else {
    if(!canManageNo(profile)) throw new PickupError('Alleen management en logistiek kunnen bestellingen wijzigen.',403);
    if(action==='cancel' || action==='restore') after=changePickup(before,action,actor,at);
    else if(action==='edit') {
      if(before.invoiceNumber) throw new PickupError('Maak eerst de factuurregistratie ongedaan voordat je de bestelling wijzigt.');
      const input=normalizeInput(body.order);
      if(input.orderNumber!==before.orderNumber || input.lineNumber!==before.lineNumber || input.edition!==before.edition) throw new PickupError('Het oorspronkelijke bestel- en regelnummer blijven bewaard.');
      if(before.collectedAt && sourceFields({...input,unitPriceEx:before.unitPriceEx,notes:before.notes})!==sourceFields(before)) throw new PickupError('Na afhalen kun je alleen de prijs en opmerkingen aanvullen. Maak voor andere wijzigingen eerst het afhalen ongedaan.');
      after={...before,...input,events:[...before.events,{at,actor,action:'edit',detail:sourceFields(before)}]};
    } else if(action==='clear-invoice' && hasFullAccess(profile)) after={...before,invoiceNumber:'',invoicedAt:null,events:[...before.events,{at,actor,action,detail:before.invoiceNumber}]};
    else throw new PickupError('Onbekende wijziging.');
  }
  if(after===before) return before;
  const {data:saved,error:saveError}=await db.from(table).update({data:after as unknown as Json,store:after.store,revision:revision+1,updated_at:at}).eq('id',id).eq('revision',revision).select('id,revision,data').maybeSingle();
  if(saveError) throw new PickupError('Opslaan is mislukt. Probeer opnieuw.',503);
  if(!saved) throw new PickupError('Iemand heeft deze bestelling zojuist aangepast. Vernieuw de lijst.',409);
  return unpack(saved);
}
export async function markInvoice(profile:UserProfile, body:Record<string,unknown>) {
  if(!hasFullAccess(profile)) throw new PickupError('Facturen vastleggen kan alleen via management.',403);
  const invoiceNumber=text(body.invoiceNumber,100), items=body.items;
  if(!invoiceNumber || !Array.isArray(items) || !items.length || items.length>1000) throw new PickupError('Vul het factuurnummer in en selecteer afhalingen.');
  const selected=items.map((v:unknown)=>{const o=v as Record<string,unknown>; if(!/^[a-f0-9]{64}$/.test(String(o?.id)) || !Number.isSafeInteger(o?.revision)) throw new PickupError('Ongeldige selectie.');return {id:String(o.id),revision:Number(o.revision)};});
  if(new Set(selected.map(o=>o.id)).size!==selected.length) throw new PickupError('Dubbele selectie.');
  const {data,error}=await createAdminClient().rpc('persoonlijke_noot_mark_invoice',{p_items:selected,p_number:invoiceNumber,p_actor:profile.full_name||profile.email});
  if(error) throw new PickupError('Een afhaling is intussen gewijzigd of staat al op een factuur. Vernieuw de lijst en controleer de selectie.',409);
  return data;
}
