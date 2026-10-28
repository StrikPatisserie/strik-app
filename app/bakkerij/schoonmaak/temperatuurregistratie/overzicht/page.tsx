import { redirect } from "next/navigation";

export default async function LegacyProductionPage({searchParams}:{searchParams:Promise<{winkel?:string;locatie?:string}>}) {
  const query=await searchParams;
  const location=query.winkel || query.locatie;
  const suffix=location?`?locatie=${encodeURIComponent(location)}`:"";
  redirect(`/bakkerij/productie/haccp/bakkerij/temperaturen/overzicht${suffix}`);
}
