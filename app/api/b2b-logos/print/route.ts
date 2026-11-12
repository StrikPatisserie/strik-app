import {logoContext,logoHeaders} from "@/app/sinterklaas/b2b/logos/access.server";
import {logoPrintLayout,type PrintLogo} from "@/app/sinterklaas/b2b/logos/model";
import {createLogoPrint} from "@/app/sinterklaas/b2b/logos/print.server";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request) {
 const c=await logoContext(request,true);if(c.error)return c.error;
 try {
  const raw=await request.text();if(raw.length>20000)throw Error("Te veel printinstellingen.");
  const body=JSON.parse(raw);
  const items=body.logos as PrintLogo[];
  if(!Array.isArray(items))throw Error("Kies eerst logo’s om te printen.");
  const cells=logoPrintLayout(items);
  const ids=[...new Set(cells.map(cell=>cell.id))];
  const result=await c.db.from("b2b_order_logos").select("id,name,content_type,bytes_base64,printed_at").eq("order_id",c.orderId).eq("season",c.year).in("id",ids);
  if(result.error)return Response.json({message:"Logo’s laden is mislukt."},{status:503,headers:logoHeaders});
  if(result.data?.length!==ids.length)throw Error("Een gekozen logo is verwijderd. Vernieuw de lijst.");
  if(result.data.some(logo=>logo.printed_at)&&body.confirmReprint!==true)return Response.json({message:"Een geselecteerd logo is al als geprint afgevinkt. Vernieuw de lijst en bevestig bewust een herdruk."},{status:409,headers:logoHeaders});
  const bytes=await createLogoPrint(items,result.data,c.customer);
  return new Response(new Uint8Array(bytes),{headers:{...logoHeaders,"Content-Type":"application/pdf","Content-Disposition":"inline; filename=\"Strik-logo-printvel.pdf\"","X-Content-Type-Options":"nosniff"}});
 } catch(error){return Response.json({message:error instanceof Error?error.message:"Printvel maken is mislukt."},{status:400,headers:logoHeaders});}
}
