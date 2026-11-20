import 'server-only';
import {randomUUID} from 'node:crypto';
import {seasonDb,getSeason} from './server';
import {validateEdition,type SeasonFile,type SeasonProduct} from './assortment';
export const SEASON_BUCKET='holiday-season-files';
export async function readAssortment(season:string,year:number):Promise<SeasonProduct[]>{
 validateEdition(season,year);const {data,error}=await seasonDb().from('holiday_products').select('*').eq('season',season).eq('year',year).order('name');
 if(error)throw Error('Het assortiment kon niet worden geladen.');return data||[];
}
export async function readSeasonFiles(season:string,year:number):Promise<SeasonFile[]>{
 validateEdition(season,year);const {data,error}=await seasonDb().from('holiday_files').select('id,season,year,kind,name,content_type,size,created_at').eq('season',season).eq('year',year).eq('kind','document').order('created_at',{ascending:false});
 if(error)throw Error('De documenten konden niet worden geladen.');return data||[];
}
export async function editableAssortment(season:string,year:number){validateEdition(season,year);const edition=await getSeason(season,year);if(!edition||!['active','opening'].includes(edition.state))throw Error('Dit assortiment is afgesloten. Kies een open editie.');return edition;}
export function detectSeasonFile(bytes:Buffer,name:string,kind:'photo'|'document'){
 if(!bytes.length||bytes.length>8*1024*1024)throw Error('Kies een bestand van maximaal 8 MB.');
 if(bytes.subarray(0,3).equals(Buffer.from([255,216,255])))return {type:'image/jpeg',ext:'jpg'};
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {type:'image/png',ext:'png'};
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return {type:'image/webp',ext:'webp'};
 if(['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()))return {type:'image/gif',ext:'gif'};
 if(kind==='document'){
  if(bytes.subarray(0,5).toString()==='%PDF-')return {type:'application/pdf',ext:'pdf'};
  if(bytes.subarray(0,2).toString()==='PK'&&/\.(docx|xlsx)$/i.test(name)){const ext=name.toLowerCase().endsWith('.docx')?'docx':'xlsx';return {type:ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ext};}
  if(/\.csv$/i.test(name)&&!bytes.includes(0))return {type:'text/csv',ext:'csv'};
 }
 throw Error(kind==='photo'?'Kies een foto als JPG, PNG, WebP of GIF.':'Kies een PDF, Word-, Excel-, CSV-bestand of afbeelding.');
}
export async function storeSeasonFile(season:string,year:number,kind:'photo'|'document',name:string,bytes:Buffer,actor:string|null){
 validateEdition(season,year);if(kind==='photo')await editableAssortment(season,year);else if(!await getSeason(season,year))throw Error('Open deze editie eerst.');
 const {type,ext}=detectSeasonFile(bytes,name,kind),id=randomUUID(),path=`${season}/${year}/${id}.${ext}`,db=seasonDb();
 const {error:uploadError}=await db.storage.from(SEASON_BUCKET).upload(path,bytes,{contentType:type,upsert:false});
 if(uploadError)throw Error('Het bestand kon niet worden bewaard. Probeer opnieuw.');
 const {data,error}=await db.from('holiday_files').insert({id,season,year,kind,name:name.replace(/[\r\n]/g,' ').slice(0,180),storage_path:path,content_type:type,size:bytes.length,created_by:actor}).select('id').single();
 if(error){await db.storage.from(SEASON_BUCKET).remove([path]);throw Error('Het bestand kon niet aan deze editie worden gekoppeld.');}
 return data.id as string;
}
