import { processPaymentRequests } from '@/app/management/betaalverzoeken/paymentServer';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({message:'Geen toegang.'},{status:403});
 try{const result=await processPaymentRequests();return Response.json(result,{status:result.failed?502:200});}catch{return Response.json({message:'De betaalverzoekencontrole kon niet worden uitgevoerd.'},{status:503});}
}
