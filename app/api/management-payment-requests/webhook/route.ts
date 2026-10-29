import { paymentService, validPaymentWebhook } from '@/app/management/betaalverzoeken/paymentServer';
import { validRequestId } from '@/app/management/betaalverzoeken/paymentRequests';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const url=new URL(request.url),id=url.searchParams.get('request')||'';
 if(!validRequestId(id)||!validPaymentWebhook(id,url.searchParams.get('token')||''))return Response.json({message:'Ongeldige webhook.'},{status:401});
 // The body is never trusted for a paid status: always re-read our stored link at Mollie.
 try{await paymentService.sync(id);return Response.json({ok:true});}catch{return Response.json({message:'Betaalstatus wordt opnieuw gecontroleerd.'},{status:503});}
}
