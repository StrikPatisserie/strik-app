import 'server-only';
import {christmasProducts} from '../kerst-voor-bedrijven/christmasProducts';
import {amsterdamYear} from './model';
import {seasonDb} from './server';
import {editableAssortment,readAssortment,storeSeasonFile} from './assortment.server';
type ImportProduct={name:string;variant:string;category:string;price_cents:number;image:string;source_key:string;source_label:string;source_url:string};
const SHOP='https://webshop.strik-patisserie.nl';
const GROUPS:Record<string,string>={sint:'sinterklaas',kerst:'kerst', 'oud-en-nieuw':'oud-en-nieuw',pasen:'pasen',koningsdag:'koningsdag',valentijn:'valentijn',moederdag:'moederdag',vaderdag:'vaderdag',vierdaagse:'vierdaagse'};
const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;|&#160;/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
function category(name:string){return /taart|vlaai/i.test(name)?'Taart':/gebak|gateau|punt|tompouce/i.test(name)?'Gebak':/chocolade|bonbon|marsepein|borstplaat/i.test(name)?'Chocolade':/stol|brood/i.test(name)?'Brood':/pakket|kado|geschenk|duo|stoomboot/i.test(name)?'Geschenken':'Koek & cake';}
export function parseSeasonWebshop(html:string,group:string):ImportProduct[]{
 const result:ImportProduct[]=[],seen=new Set<string>();
 for(const match of html.matchAll(/<a\b[^>]*class=["']product["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const path=clean(match[1]),block=match[2];
  if(!path.startsWith(`/assortiment/${group}/`)||seen.has(path))continue;
  const name=clean(block.match(/class=["']productButtonProductName["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||'');
  const euros=clean(block.match(/class=["']large["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||'').replace(/\D/g,'');
  const cents=clean(block.match(/class=["']small["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||'').replace(/\D/g,'');
  const image=block.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1]||'';
  if(!name||!euros||!image.startsWith('/images/products/'))continue;
  const price=Number(euros)*100+Number(cents.padEnd(2,'0').slice(0,2));if(!Number.isSafeInteger(price)||price<1)continue;
  const from=Boolean(clean(block.match(/class=["']from["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||''));
  result.push({name,variant:from?'Vanafprijs · uitvoering volgens webshop':'',category:category(name),price_cents:price,image:new URL(clean(image),SHOP).href,source_key:`webshop:${path}`,source_label:'Webshop',source_url:new URL(path,SHOP).href});seen.add(path);
 }
 return result;
}
export async function limitedResponse(response:Response,max:number){
 if(!response.ok)throw Error('De bron is tijdelijk niet beschikbaar.');
 if(Number(response.headers.get('content-length'))>max)throw Error('Het bronbestand is te groot.');
 const reader=response.body?.getReader();if(!reader)throw Error('Het bronbestand is leeg.');
 const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Het bronbestand is te groot.');chunks.push(value);}}finally{await reader.cancel();}
 return Buffer.concat(chunks);
}
export async function importSeasonProducts(season:string,year:number,source:'webshop'|'folder',actor:string|null){
 await editableAssortment(season,year);if(year!==amsterdamYear())throw Error('Actuele bronprijzen kun je alleen in het huidige jaar overnemen. Voor andere jaren kun je de producten zelf invullen.');
 let products:ImportProduct[];
 if(source==='folder'){
  if(season!=='kerst')throw Error('Deze folder hoort bij Kerst.');
  products=christmasProducts.map(p=>({name:p.name,variant:p.detail,category:category(p.name),price_cents:Math.round(p.retailPriceIncl*100),image:p.image?new URL(p.image,'https://app.strik-patisserie.nl').href:'',source_key:`folder:kerst:${p.id}`,source_label:'Kerstfolder · verkoopprijs',source_url:''}));
 }else{
  const group=GROUPS[season];if(!group)throw Error('Geen webshopgroep ingesteld voor dit seizoen.');
  const response=await fetch(`${SHOP}/assortiment/${group}`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(response.status===404)throw Error('Dit seizoensassortiment staat nog niet in de webshop. Je kunt zelf producten toevoegen.');
  products=parseSeasonWebshop((await limitedResponse(response,3*1024*1024)).toString(),group);
  if(!products.length)throw Error('Er zijn nog geen producten met prijs en foto gevonden in deze webshopgroep.');
 }
 const existing=new Set((await readAssortment(season,year)).map(p=>p.source_key));let added=0,skipped=0,failed=0;
 for(const p of products){
  if(existing.has(p.source_key)){skipped++;continue;}
  try{
   const url=new URL(p.image);if(!['app.strik-patisserie.nl','webshop.strik-patisserie.nl'].includes(url.hostname)||url.protocol!=='https:'||url.username||url.password)throw Error('Onbekende fotobron.');
   const image=await limitedResponse(await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)}),8*1024*1024);
   const photo_id=await storeSeasonFile(season,year,'photo',p.name,image,actor);
   const {image:_,...record}=p;void _;
   const {error}=await seasonDb().from('holiday_products').insert({...record,season,year,photo_id,price_includes_vat:true,updated_by:actor});
   if(error){if(error.code==='23505'){skipped++;continue;}throw error;}added++;
  }catch{failed++;}
 }
 return {added,skipped,failed};
}
