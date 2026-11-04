import "server-only";
import {readDocument} from "./productie/documents.server";
import {recipeStorageAuthHeaders} from "./lib/recipeStorageAuth";
import type {BakeryHomeOffer} from "./bakkerij/recepturen/types";

type OfferDocument={bakeryHome?:{offers?:BakeryHomeOffer[]}};
/** Home viewers receive only the published offer fields, never recipe finances. */
export async function loadWeeklyOffers():Promise<BakeryHomeOffer[]> {
  const shared=await readDocument<OfferDocument>("recipes");
  let data=shared?.data;
  if(!shared) {
    const url=new URL("https://strik-patisserie.nl/wp-json/strik/v1/recepturen");
    url.searchParams.set("key",process.env.WORDPRESS_RECEPTUREN_API_KEY||process.env.WORDPRESS_STRIK_API_KEY||"schoonmaak-ijs-strik");
    const response=await fetch(url,{cache:"no-store",headers:await recipeStorageAuthHeaders(),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error("Aanbiedingen tijdelijk niet beschikbaar.");
    data=await response.json();
  }
  return (Array.isArray(data?.bakeryHome?.offers)?data.bakeryHome.offers:[]).map(({id,weekStart,weekEnd,label,imageUrl,updatedAt,createdAt})=>({id,weekStart,weekEnd,label,imageUrl,updatedAt,createdAt}));
}
