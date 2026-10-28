import { notFound } from "next/navigation";
import PersonalWorkspace from "../../persoonlijk/PersonalWorkspace";
export const dynamic="force-dynamic";
export const metadata={title:"Persoonlijke to-do’s · preview",robots:{index:false,follow:false}};
export default function PersonalPreview(){if(process.env.NODE_ENV!=="development")notFound();return <PersonalWorkspace demo/>;}
