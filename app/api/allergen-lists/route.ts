import { recipeStorageAuthHeaders } from "@/app/lib/recipeStorageAuth";
import { NextResponse } from "next/server";
import type { CustomerAllergenList } from "@/app/bakkerij/allergenen/types";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import { ProductionStoreError, readDocument, saveDocument } from "@/app/productie/documents.server";
import type { RecepturenData } from "@/app/bakkerij/recepturen/recepturenApi";

const WORDPRESS_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/recepturen-allergen-lists";
const API_KEY =
  process.env.WORDPRESS_RECEPTUREN_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

function wordpressUrl() {
  const url = new URL(WORDPRESS_URL);
  url.searchParams.set("key", API_KEY);
  return url;
}

async function relay(response: Response) {
  const data = await response.json().catch(() => null);
  return NextResponse.json(data ?? { message: "WordPress gaf geen geldig antwoord." }, {
    status: response.ok ? 200 : response.status === 404 ? 503 : response.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  if (!productionDepartments(await getCurrentProfile()).length) return NextResponse.json({message:"Geen toegang."},{status:403});
  try {
    const shared=await readDocument<RecepturenData>("recipes");
    if(shared)return NextResponse.json({lists:shared.data.allergenLists || [],storageRevision:shared.revision},{headers:{"Cache-Control":"private, no-store"}});
    return relay(await fetch(wordpressUrl(), { cache: "no-store", headers: await recipeStorageAuthHeaders() }));
  } catch {
    return NextResponse.json({ message: "Kan het allergenenarchief niet laden." }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const profile=await getCurrentProfile();
  if (!profile || !productionDepartments(profile).length) return NextResponse.json({message:"Geen toegang."},{status:403});
  const body = await request.json().catch(() => null) as { lists?: CustomerAllergenList[]; storageRevision?:number } | null;
  if (!Array.isArray(body?.lists)) {
    return NextResponse.json({ message: "Geen geldige allergenenlijsten ontvangen." }, { status: 400 });
  }
  try {
    const shared=await readDocument<RecepturenData>("recipes");
    if(shared){
      if(body.storageRevision!==shared.revision)throw new ProductionStoreError("Het archief is intussen gewijzigd. Ververs eerst de pagina.",409);
      const revision=await saveDocument("recipes",shared.revision,{...shared.data,allergenLists:body.lists,updatedAt:new Date().toISOString()},profile.id,"Allergenenarchief bijgewerkt");
      return NextResponse.json({lists:body.lists,storageRevision:revision},{headers:{"Cache-Control":"private, no-store"}});
    }
    return relay(await fetch(wordpressUrl(), {
      method: "PUT",
      headers: { ...await recipeStorageAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ lists: body.lists }),
      cache: "no-store",
    }));
  } catch(error) {
    if(error instanceof ProductionStoreError)return NextResponse.json({message:error.message},{status:error.status});
    return NextResponse.json({ message: "Kan het allergenenarchief niet opslaan." }, { status: 502 });
  }
}
