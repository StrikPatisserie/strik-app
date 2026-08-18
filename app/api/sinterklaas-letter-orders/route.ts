import {
  proxySinterklaasGet,
  proxySinterklaasMutation,
} from "@/app/sinterklaas/sinterklaasServerApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "sinterklaas-letter-orders";

export async function GET(request: Request) {
  return proxySinterklaasGet(request, ENDPOINT);
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
