import {holiday} from './model';
export type SeasonProduct={id:string;season:string;year:number;name:string;variant:string;category:string;price_cents:number;price_includes_vat:boolean;photo_id:string|null;source_key:string;source_label:string;source_url:string;active:boolean;revision:number;updated_at:string};
export type SeasonFile={id:string;season:string;year:number;kind:'photo'|'document';name:string;content_type:string;size:number;created_at:string};
export const PRODUCT_CATEGORIES=['Gebak','Taart','Chocolade','Brood','Koek & cake','Geschenken','Overig'];
export function validateEdition(season:string,year:number){if(!holiday(season)||!Number.isInteger(year)||year<2020||year>2100)throw Error('Kies een geldig seizoen en jaar.');}
export function validateProduct(input:Record<string,unknown>){
 const name=String(input.name||'').trim(),variant=String(input.variant||'').trim(),category=String(input.category||'Overig');
 const price=String(input.price??'').trim();
 if(!name||name.length>180||variant.length>500||!PRODUCT_CATEGORIES.includes(category))throw Error('Controleer de productnaam, uitvoering en categorie.');
 if(!/^\d+(?:[.,]\d{1,2})?$/.test(price)||Number(price.replace(',','.'))>100000)throw Error('Vul een geldige prijs in, met maximaal twee decimalen.');
 if(typeof input.priceIncludesVat!=='boolean')throw Error('Kies of de prijs inclusief of exclusief btw is.');
 return {name,variant,category,price_cents:Math.round(Number(price.replace(',','.'))*100),price_includes_vat:input.priceIncludesVat};
}
export const productPhotoUrl=(id:string)=>`/api/feestdagen/bestanden/${encodeURIComponent(id)}`;
export const productMoney=(cents:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
