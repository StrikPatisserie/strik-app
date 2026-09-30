import { NextResponse } from "next/server";
import type { LogisticsPreparationProduct } from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  getLogisticsPreparationProducts,
  replaceLogisticsPreparationProducts,
} from "@/app/lib/bakeryLogisticsStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function cleanText(value: unknown, maxLength = 200) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanArticleNumber(value: unknown) {
  return String(value || "")
    .toUpperCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.]/g, "")
    .slice(0, 24);
}

function cleanPreparationProduct(
  value: unknown
): LogisticsPreparationProduct | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const articleNumber = cleanArticleNumber(raw.articleNumber);
  const articleName = cleanText(raw.articleName, 200);
  if (
    !articleName ||
    !/^(?:\d{3,9}|[A-Z]{1,4}\d{3,9})(?:\.[A-Z0-9]{1,8})?$/.test(
      articleNumber
    )
  ) {
    return null;
  }

  return {
    id: `preparation:${articleNumber}`,
    category: "vers",
    articleNumber,
    articleName,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  if (!(await canAccessLogisticsRequest(request))) {
    return jsonError("Geen toegang tot bakkerij logistiek.", 403);
  }

  try {
    const products = await getLogisticsPreparationProducts();

    return NextResponse.json({
      ok: true,
      products,
      count: products.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Producten voor de verdeellijst ophalen is mislukt.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!(await canAccessLogisticsRequest(request, cleanText(body.key, 200)))) {
      return jsonError("Geen toegang tot bakkerij logistiek.", 403);
    }

    if (!Array.isArray(body.products)) {
      return jsonError("Geen geldige productlijst ontvangen.");
    }

    const productsByNumber = new Map<string, LogisticsPreparationProduct>();
    body.products.map(cleanPreparationProduct).forEach((product) => {
      if (!product) return;
      productsByNumber.set(product.articleNumber, product);
    });
    const products = await replaceLogisticsPreparationProducts(
      Array.from(productsByNumber.values())
    );

    return NextResponse.json({
      ok: true,
      products,
      count: products.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Producten voor de verdeellijst opslaan is mislukt.",
      },
      { status: 502 }
    );
  }
}
