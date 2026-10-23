const fs=require('node:fs'),assert=require('node:assert/strict');
// Optional in-memory SQL check; install PGlite in a temporary directory, never in production.
// node scripts/check-tamigo-corrections-sql.cjs /path/to/temporary/pglite-install
const path=require('node:path');
const packageDirectory=process.argv[2];
if(!packageDirectory)throw Error('Supply a temporary directory containing @electric-sql/pglite.');
const {PGlite}=require(require.resolve('@electric-sql/pglite',{paths:[path.resolve(packageDirectory)]}));
(async()=>{
 const db=new PGlite();
 await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
 await db.exec(fs.readFileSync('app/supabase/migrations/20261023170000_tamigo_hours_corrections.sql','utf8'));
 const insert=`insert into public.tamigo_hours_corrections(id,actor_id,shift_id,reference,before_snapshot,after_values,reason,mode,update_payload,expires_at) values($1,'11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','{}','{"original":"unchanged"}','{}','Testcorrectie','manual','{}',now()+interval '10 minutes')`;
 const id='44444444-4444-4444-8444-444444444444',second='55555555-5555-4555-8555-555555555555';
 await db.exec('set role service_role');await db.query(insert,[id]);
 const claim=()=>db.query(`select public.strik_claim_tamigo_hours_correction($1,'11111111-1111-4111-8111-111111111111') as result`,[id]);
 assert.equal((await claim()).rows[0].result.acquired,true);assert.equal((await claim()).rows[0].result.acquired,false);
 await db.query(insert,[second]);await assert.rejects(()=>db.query(`select public.strik_claim_tamigo_hours_correction($1,'11111111-1111-4111-8111-111111111111')`,[second]),/in flight/);
 await assert.rejects(()=>db.query(`update public.tamigo_hours_corrections set before_snapshot='{}' where id=$1`,[id]),/immutable/);
 await db.query(`update public.tamigo_hours_corrections set state='unknown' where id=$1`,[id]);
 await assert.rejects(()=>db.query(`select public.strik_claim_tamigo_hours_correction($1,'11111111-1111-4111-8111-111111111111')`,[second]),/uncertain/);
 await db.query(`update public.tamigo_hours_corrections set state='applied',verified_by='22222222-2222-4222-8222-222222222222' where id=$1`,[id]);
 assert.equal((await db.query(`select actor_id from public.tamigo_hours_correction_events where correction_id=$1 order by id desc limit 1`,[id])).rows[0].actor_id,'22222222-2222-4222-8222-222222222222');
 assert.equal((await db.query(`select before_snapshot from public.tamigo_hours_corrections where id=$1`,[id])).rows[0].before_snapshot.original,'unchanged');
 await assert.rejects(()=>db.query(`update public.tamigo_hours_corrections set state='prepared' where id=$1`,[id]),/Invalid/);
 await assert.rejects(()=>db.query(`delete from public.tamigo_hours_correction_events where correction_id=$1`,[id]),/permission/);
 await assert.rejects(()=>db.query(`delete from public.tamigo_hours_corrections where id=$1`,[id]),/permission/);
 await db.exec('reset role;set role authenticated');
 await assert.rejects(()=>db.query('select * from public.tamigo_hours_corrections'),/permission/);
 await assert.rejects(()=>db.query(`select public.strik_claim_tamigo_hours_correction($1,'11111111-1111-4111-8111-111111111111')`,[second]),/permission/);
 await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from public.tamigo_hours_correction_events'),/permission/);
 await db.close();console.log('SQL passed: migration, immutable originals, one in-flight correction, idempotent claim, uncertain lock, audited reconciliation, denied staff/anonymous reads and writes.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
