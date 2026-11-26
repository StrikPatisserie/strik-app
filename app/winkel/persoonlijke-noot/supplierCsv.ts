import { parseCsv, type CsvData } from './csv';
import { dateOnly, identity, normalizeInput, normalizeStore, type OrderInput } from './model';

export const supplierHeaders = ['order_number','code','firstname','middlename','lastname','email','sku','qty','product','option','ean'];
export function isSupplierCsv(data:CsvData) { return supplierHeaders.every(h=>data.headers.includes(h)); }
export function seasonForDate(value:string) { const d=dateOnly(value);return String(Number(d.slice(0,4))-(Number(d.slice(5,7))<=4?1:0)); }
export function availableFrom(orderDate:string) {
  const d=new Date(`${dateOnly(orderDate)}T12:00:00Z`);let remaining=2;
  while(remaining) {d.setUTCDate(d.getUTCDate()+1);const md=d.toISOString().slice(5,10);if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&!['01-01','12-25','12-26'].includes(md))remaining--;}
  return d.toISOString().slice(0,10);
}
// Agreed supplier prices for season 2026. These are not the face value of the card.
const prices2026:Record<string,number>={'17.5':12.84,'25':18.35,'45':33.03,'50':36.70};
export function mapSupplierCsv(data:CsvData,options:{edition:string;orderDate:string;sourceName?:string}) {
  if(!isSupplierCsv(data))throw Error('De kolommen wijken af van het Persoonlijke Noot-bestand. Gebruik de handmatige CSV-import.');
  const orderDate=dateOnly(options.orderDate);if(!orderDate)throw Error('Vul de besteldatum uit de mail in.');
  const sampleFile=/(?:voorbeeld|sample|\btest\b)/i.test(options.sourceName||'');
  const orders:OrderInput[]=[],errors:string[]=[],warnings:string[]=[],seen=new Set<string>();let sample=sampleFile;
  data.rows.forEach((row,index)=>{
    try {
      const v=(key:string)=>(row[key]||'').trim();
      sample ||= /^bestelnummer$/i.test(v('order_number')) || /^voornaam$/i.test(v('firstname')) || /^klantcode$/i.test(v('code'));
      if(!v('code')||!v('firstname')||!v('lastname'))throw Error('Klantcode, voornaam en achternaam ontbreken.');
      const store=normalizeStore(v('option'));if(!store)throw Error(`Afhaalwinkel “${v('option')}” niet herkend. Controleer de winkel; Wijchen wordt niet meer gebruikt.`);
      const match=v('sku').match(/^Strik Patisserie cadeaukaart\s+t\.?\s*w\.?\s*v\.?\s*€?\s*(\d+(?:[.,]\d{1,2})?)\s*$/i);
      if(!match)throw Error(`Cadeaukaartwaarde niet herkend in “${v('sku')}”.`);
      const value=Number(match[1].replace(',','.'));if(!Number.isFinite(value)||value<=0||value>100000)throw Error('Controleer de cadeaukaartwaarde.');
      const unitPriceEx=options.edition==='2026'?(prices2026[String(value)]??null):null;
      if(unitPriceEx===null)warnings.push(`Factuurprijs voor cadeaukaart €${value} in seizoen ${options.edition} nog invullen.`);
      const order=normalizeInput({edition:options.edition,orderNumber:v('order_number'),lineNumber:`pn:${v('code')}:${v('sku')}`,customerCode:v('code'),email:v('email'),
        name:[v('firstname'),v('middlename'),v('lastname')].filter(Boolean).join(' '),product:`Cadeaukaart €${value.toFixed(2).replace('.',',')}`,quantity:v('qty'),store,
        orderDate,pickupDate:availableFrom(orderDate),pickupDateKind:'from',reference:orderDate.split('-').reverse().join('-'),notes:'',unitPriceEx});
      const key=identity(order);if(seen.has(key))throw Error('Dubbele bestelregel met dezelfde klantcode en cadeaukaartwaarde; controleer eerst het bronbestand.');seen.add(key);orders.push(order);
    }catch(e){errors.push(`Regel ${index+2}: ${e instanceof Error?e.message:'Ongeldige gegevens.'}`);}
  });
  return {orders,errors,warnings:[...new Set(warnings)],sample};
}
export function parseSupplierCsv(content:string,options:Parameters<typeof mapSupplierCsv>[1]) { return mapSupplierCsv(parseCsv(content),options); }
