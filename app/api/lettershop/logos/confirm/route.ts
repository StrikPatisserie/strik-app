import { logoAccess, logoHeaders, uuid } from "@/app/sinterklaas/letters/online/logos/access.server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const context = await logoAccess(request, true);
  if (context.error) return context.error;
  try {
    const raw = await request.text();
    if (raw.length > 10000) throw new Error("Te veel regels geselecteerd.");
    const input = JSON.parse(raw);
    if (input.confirmed !== true || typeof input.jobId !== "string" || !uuid.test(input.jobId)
      || !Array.isArray(input.itemIds) || !input.itemIds.length || input.itemIds.length > 100
      || input.itemIds.some((id: unknown) => typeof id !== "string" || !uuid.test(id))) {
      throw new Error("Bevestig welke bestellingen echt geprint zijn.");
    }
    const { data, error } = await context.db.rpc("lettershop_confirm_logo_print", {
      p_job_id: input.jobId, p_item_ids: input.itemIds, p_actor_id: context.profile.id,
    });
    if (error) return Response.json({ message: error.message }, { status: 409, headers: logoHeaders });
    return Response.json({ printedAt: data }, { headers: logoHeaders });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Bevestigen is mislukt." }, { status: 400, headers: logoHeaders });
  }
}
