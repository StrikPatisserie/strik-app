import { withProductionReadiness } from "@/app/sinterklaas/letters/productie/productionReadiness.server";
import {
  proxySinterklaasGet,
  proxySinterklaasMutation,
} from "@/app/sinterklaas/sinterklaasServerApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "sinterklaas-letter-orders";

export async function GET(request: Request) {
  return withProductionReadiness(await proxySinterklaasGet(request, ENDPOINT), new URL(request.url).searchParams.get("year") || String(new Date().getFullYear()), "wordpress");
}

export async function POST(request: Request) {
  return proxySinterklaasMutation(request, ENDPOINT, "POST");
}

export async function PATCH(request: Request) {
  return proxySinterklaasMutation(request, ENDPOINT, "PATCH");
}

export async function DELETE(request: Request) {
  return proxySinterklaasMutation(request, ENDPOINT, "DELETE");
}
