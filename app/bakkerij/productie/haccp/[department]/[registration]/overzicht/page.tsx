import { notFound } from "next/navigation";
import { TemperatureRegistrationOverviewPage } from "@/app/winkel/schoonmaak-registratie/overzicht/page";
import { bakkerijTemperatureOptions, bakkerijTemperatureRows } from "@/app/winkel/schoonmaak-registratie/temperatureRegistrationShared";
export default async function HaccpTemperatureOverview({params}:{params:Promise<{department:string;registration:string}>}){
 const {department,registration}=await params;if(department!=="bakkerij"||registration!=="temperaturen")notFound();
 return <TemperatureRegistrationOverviewPage embedded title="Temperaturen" locationOptions={bakkerijTemperatureOptions} rowsByLocation={bakkerijTemperatureRows} defaultLocationId="bakkerij" registrationHref="/bakkerij/productie/haccp/bakkerij/temperaturen" loadCleaningFallback={false} allLocationsLabel="Alle bakkerijlocaties"/>;
}
