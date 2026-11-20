import Link from "next/link";
import {requireCurrentProfile} from "@/app/lib/auth/session";
import {getActiveSeason} from "@/app/feestdagen/server";
export default async function Layout({children}:{children:React.ReactNode}){
 await requireCurrentProfile(); const season=await getActiveSeason("sint");
 if(!season?.config.letters)return <main className="m-8 rounded-2xl bg-white p-8"><h1 className="text-2xl font-black">Chocoladeletters staan uit</h1><p className="my-4">Start eerst de nieuwe editie via Feestdagen. Eerdere gegevens blijven in het jaararchief.</p><Link href="/feestdagen">← Feestdagen</Link></main>;
 return children;
}
