import Link from "next/link";
import { notFound } from "next/navigation";
import { TemperatureRegistrationPage } from "@/app/winkel/schoonmaak-registratie/page";
import { bakkerijTemperatureOptions, bakkerijTemperatureRows } from "@/app/winkel/schoonmaak-registratie/temperatureRegistrationShared";
import GoodsRegistration from "@/app/bakkerij/schoonmaak/goederenregistratie/GoodsRegistration";
import KettleRegistration from "@/app/bakkerij/ijs-chocolade/haccp/temperatuurregistratie/KettleRegistration";
import AllergenenClient from "@/app/bakkerij/allergenen/AllergenenClient";
import s from "@/app/preview/productie/production.module.css";
export default async function HaccpRegistrationPage({params}:{params:Promise<{department:string;registration:string}>}){
 const {department,registration}=await params;
 const title=registration==="temperaturen"?(department==="ijs"?"Kookketel & afkoeling":"Temperaturen"):registration==="goederen"?"Goederenontvangst":"Allergenen";
 let content;
 if(department==="bakkerij"&&registration==="temperaturen") content=<TemperatureRegistrationPage embedded title="Temperaturen" locationOptions={bakkerijTemperatureOptions} rowsByLocation={bakkerijTemperatureRows} defaultLocationId="bakkerij" overviewHref="/bakkerij/productie/haccp/bakkerij/temperaturen/overzicht" loadCleaningFallback={false} allowReorder/>;
 else if(department==="bakkerij"&&registration==="goederen") content=<GoodsRegistration embedded/>;
 else if(department==="bakkerij"&&registration==="allergenen") content=<AllergenenClient embedded/>;
 else if(department==="ijs"&&registration==="temperaturen") content=<KettleRegistration embedded/>;
 else notFound();
 return <><div className={s.resourceHeading}><Link href={`/bakkerij/productie/haccp/${department}`}>← Alle registraties</Link><h2>{title}</h2></div>{content}</>;
}
