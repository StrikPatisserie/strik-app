import Papa from 'papaparse';
import { dateOnly, normalizeInput, normalizeStore, identity, type OrderInput } from './model';
export const fields = [
  ['orderNumber','Bestelnummer *'], ['lineNumber','Regelnummer'], ['name','Naam *'], ['product','Product *'],
  ['quantity','Aantal *'], ['store','Afhaalwinkel'], ['pickupDate','Afhaaldatum'], ['reference','Bestelreferentie'],
  ['notes','Opmerkingen'], ['unitPriceEx','Stuksprijs excl. btw'],
] as const;
export type Mapping = Partial<Record<typeof fields[number][0], string>>;
export type CsvData = { headers: string[]; rows: Record<string, string>[] };
export function parseCsv(content: string): CsvData {
  if (content.length > 2_000_000) throw Error('Het bestand is te groot (maximaal 2 MB).');
  if (/^\s*</.test(content)) throw Error('Dit is geen CSV-bestand. Gebruik de knop Download CSV; de XML-koppeling volgt na controle van een werkend bestand.');
  const parsed = Papa.parse<string[]>(content.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  if (parsed.errors.some(e=>e.code !== 'UndetectableDelimiter')) throw Error('Het CSV-bestand bevat ongeldige aanhalingstekens of scheidingstekens.');
  const [header = [], ...body] = parsed.data;
  const headers = header.map(h=>h.trim());
  if (headers.length < 2 || headers.some(h=>!h) || new Set(headers).size !== headers.length) throw Error('Het bestand heeft een unieke kolomkop per kolom nodig.');
  if (!body.length || body.length > 1000) throw Error('Importeer 1 tot maximaal 1.000 regels tegelijk.');
  if (body.some(row=>row.length !== headers.length)) throw Error('Niet iedere regel heeft evenveel kolommen. Controleer het CSV-bestand.');
  return { headers, rows: body.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]]))) };
}
export function suggestMapping(headers: string[]): Mapping {
  const aliases: Record<string,string[]> = { orderNumber:['bestelnummer','ordernummer','orderid','bestellingnummer','order number'], lineNumber:['regelnummer','orderregelid','lineid'],name:['naam','klantnaam','customer name','volledige naam'],product:['product','productnaam','artikel','omschrijving'],quantity:['aantal','quantity','aantallen'],store:['winkel','filiaal','afhaalwinkel','afhaallocatie'],pickupDate:['afhaaldatum','ophaaldatum'],reference:['bestelreferentie','referentie'],notes:['opmerkingen','opmerking'],unitPriceEx:['prijs excl btw','stuksprijs excl btw','unit price excl vat'] };
  const normalize = (s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  return Object.fromEntries(Object.entries(aliases).map(([key,names])=>[key,headers.find(h=>names.some(n=>normalize(n)===normalize(h))) || '']));
}
export function mapCsv(data: CsvData, mapping: Mapping, defaults: {edition:string;reference:string;store:string}): { orders: OrderInput[]; errors: string[] } {
  for (const required of ['orderNumber','name','product','quantity'] as const) if (!mapping[required] || !data.headers.includes(mapping[required]!)) return {orders:[],errors:['Koppel eerst de verplichte kolommen: bestelnummer, naam, product en aantal.']};
  const orders: OrderInput[]=[], errors:string[]=[], seen=new Set<string>();
  data.rows.forEach((row,index)=>{
    try {
      const value = (key:keyof Mapping)=>row[mapping[key] || '']?.trim() || '';
      const shopValue = value('store'); const store = normalizeStore(shopValue) || defaults.store;
      if (shopValue && !normalizeStore(shopValue) && !defaults.store) throw Error(`Winkel “${shopValue}” niet herkend; kies onderaan de juiste winkel of herstel de kolom.`);
      const price = value('unitPriceEx');
      if (price && !/^\d+(?:[.,]\d{1,2})?$/.test(price)) throw Error('Ongeldige stuksprijs; gebruik bijvoorbeeld 9,95.');
      const order = normalizeInput({edition:defaults.edition,orderNumber:value('orderNumber'),lineNumber:value('lineNumber'),name:value('name'),product:value('product'),quantity:value('quantity'),store,pickupDate:dateOnly(value('pickupDate')),reference:value('reference')||defaults.reference,notes:value('notes'),unitPriceEx:price ? Number(price.replace(',','.')) : null});
      const key=identity(order); if (seen.has(key)) throw Error('Dubbel bestelnummer/product: koppel het unieke regelnummer om deze regels apart te houden.');
      seen.add(key); orders.push(order);
    } catch(e) { errors.push(`Regel ${index+2}: ${e instanceof Error ? e.message : 'Ongeldige gegevens.'}`); }
  });
  return {orders,errors};
}
