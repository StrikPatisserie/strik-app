import Link from "next/link";
import s from "@/app/preview/productie/production.module.css";
export default async function HaccpDepartmentPage({params}:{params:Promise<{department:string}>}){
 const {department}=await params;
 const items=department==="bakkerij"?[
  {id:"temperaturen",name:"Temperaturen",text:"Meetpunten en afwijkingen registreren. Bestaande metingen blijven beschikbaar."},
  {id:"goederen",name:"Goederenontvangst",text:"Temperatuur, houdbaarheid en verpakking van binnengekomen producten."},
  {id:"allergenen",name:"Allergenen",text:"Opgeslagen allergenenlijsten bekijken en bijwerken."},
 ]:[{id:"temperaturen",name:"Kookketel & afkoeling",text:"Temperaturen tijdens het ijsbereidingsproces registreren en terugzoeken."}];
 return <><div className={s.resourceCards}>{items.map(item=><Link className={s.resourceCard} key={item.id} href={`/bakkerij/productie/haccp/${department}/${item.id}`}><strong>{item.name}</strong><span>{item.text}</span><small>Open registratie →</small></Link>)}</div>
 <section className={s.infoNote}><p><strong>Schoonmaakrooster</strong><br/>Voor deze productieafdeling is nog geen digitaal rooster ingericht. De bestaande winkellijsten staan bij Winkel.</p></section></>;
}
