'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {requireAdminProfile} from '../lib/auth/session';
import {seasonDb,getSeason} from './server';
import {validateEdition,validateProduct} from './assortment';
import {editableAssortment,storeSeasonFile} from './assortment.server';
import {importSeasonProducts} from './assortment-import.server';
type Result={ok?:boolean;message:string};
const message=(e:unknown)=>e instanceof Error?e.message:'Opslaan is niet gelukt. Probeer opnieuw.';
export async function saveSeasonProduct(season:string,year:number,form:FormData):Promise<Result>{
 const actor=await requireAdminProfile();
 try{
  await editableAssortment(season,year);
  const id=String(form.get('id')||''),revision=Number(form.get('revision'));
  if(!['incl','excl'].includes(String(form.get('vat'))))throw Error('Kies of de prijs inclusief of exclusief btw is.');
  const values=validateProduct({name:form.get('name'),variant:form.get('variant'),category:form.get('category'),price:form.get('price'),priceIncludesVat:form.get('vat')==='incl'});
  const db=seasonDb();let current:{photo_id:string|null}|null=null;
  if(id){const {data,error}=await db.from('holiday_products').select('photo_id').eq('id',id).eq('season',season).eq('year',year).eq('revision',revision).maybeSingle();if(error||!data)throw Error('Dit product is intussen gewijzigd. Ververs de pagina.');current=data;}
  const file=form.get('photo');let photo_id=current?.photo_id||null;
  if(file instanceof File&&file.size){photo_id=await storeSeasonFile(season,year,'photo',file.name,Buffer.from(await file.arrayBuffer()),actor.id);}
  const patch={...values,photo_id,updated_by:actor.id};
  const result=id?await db.from('holiday_products').update(patch).eq('id',id).eq('season',season).eq('year',year).eq('revision',revision).select('id').maybeSingle():await db.from('holiday_products').insert({...patch,season,year,source_key:`manual:${randomUUID()}`}).select('id').single();
  if(result.error||!result.data)throw Error('Opslaan is niet gelukt of het product is intussen gewijzigd. Ververs de pagina.');
  revalidatePath(`/feestdagen/${season}`,'layout');return {ok:true,message:'Product bewaard bij deze editie.'};
 }catch(e){return {message:message(e)};}
}
export async function toggleSeasonProduct(season:string,year:number,id:string,revision:number,active:boolean):Promise<Result>{
 const actor=await requireAdminProfile();try{await editableAssortment(season,year);if(typeof active!=='boolean')throw Error('Controleer het product.');const {data,error}=await seasonDb().from('holiday_products').update({active,updated_by:actor.id}).eq('id',id).eq('season',season).eq('year',year).eq('revision',revision).select('id').maybeSingle();if(error||!data)throw Error('Dit product is intussen gewijzigd. Ververs de pagina.');revalidatePath(`/feestdagen/${season}`,'layout');return {ok:true,message:active?'Product weer opgenomen.':'Product uit het assortiment gehaald; de gegevens blijven bewaard.'};}catch(e){return {message:message(e)};}
}
export async function importAssortment(season:string,year:number,source:'webshop'|'folder'):Promise<Result>{
 const actor=await requireAdminProfile();try{if(!['webshop','folder'].includes(source))throw Error('Onbekende bron.');const r=await importSeasonProducts(season,year,source,actor.id);revalidatePath(`/feestdagen/${season}`,'layout');return {ok:r.failed===0,message:`${r.added} producten toegevoegd. ${r.skipped} al aanwezig.${r.failed?` ${r.failed} producten konden nog niet worden overgenomen. Probeer opnieuw; bestaande producten blijven behouden.`:''}`};}catch(e){return {message:message(e)};}
}
export async function uploadSeasonDocument(season:string,year:number,form:FormData):Promise<Result>{
 const actor=await requireAdminProfile();try{validateEdition(season,year);if(!await getSeason(season,year))throw Error('Open deze editie eerst.');const file=form.get('file');if(!(file instanceof File)||!file.size)throw Error('Kies een document.');await storeSeasonFile(season,year,'document',file.name,Buffer.from(await file.arrayBuffer()),actor.id);revalidatePath(`/feestdagen/${season}/documenten`);return {ok:true,message:'Document bewaard bij deze editie.'};}catch(e){return {message:message(e)};}
}
