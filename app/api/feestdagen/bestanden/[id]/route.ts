import {getCurrentProfile} from '@/app/lib/auth/session';
import {canAccessPath,hasFullAccess} from '@/app/lib/auth/access';
import {seasonDb} from '@/app/feestdagen/server';
import {SEASON_BUCKET} from '@/app/feestdagen/assortment.server';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const profile=await getCurrentProfile();if(!profile?.active||!canAccessPath(profile,'/feestdagen'))return new Response('Geen toegang.',{status:403});
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return new Response('Niet gevonden.',{status:404});
 const db=seasonDb(),{data:file,error}=await db.from('holiday_files').select('kind,name,content_type,storage_path').eq('id',id).maybeSingle();
 if(error)return new Response('Bestand tijdelijk niet bereikbaar.',{status:503});if(!file)return new Response('Niet gevonden.',{status:404});
 if(file.kind==='document'&&!hasFullAccess(profile))return new Response('Geen toegang.',{status:403});
 const {data,error:downloadError}=await db.storage.from(SEASON_BUCKET).download(file.storage_path);if(downloadError||!data)return new Response('Bestand tijdelijk niet bereikbaar.',{status:503});
 return new Response(data,{headers:{'Content-Type':file.content_type,'Content-Disposition':`${file.kind==='photo'?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g,'%27')}`,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
