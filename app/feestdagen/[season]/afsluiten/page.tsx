import {notFound} from "next/navigation";
import {StrikShell} from "../../../StrikUI";
import {requireAdminProfile} from "../../../lib/auth/session";
import {getSeason,wordpressSeason,previewCentral} from "../../server";
import {amsterdamYear,holiday,seasonSummary} from "../../model";
import CloseWizard from "../../CloseWizard";
import styles from "../../Feestdagen.module.css";
export const dynamic="force-dynamic";
export default async function ClosePage({params,searchParams}:{params:Promise<{season:string}>;searchParams:Promise<{jaar?:string}>}){
 await requireAdminProfile();const {season:id}=await params,query=await searchParams,h=holiday(id);if(!h)notFound();
 const year=/^20\d{2}$/.test(query.jaar||"")?Number(query.jaar):amsterdamYear(),season=await getSeason(id,year);if(!season)notFound();
 const [sources,central]=await Promise.all([wordpressSeason(h.id,year,"read"),id==="sint"?previewCentral(year):Promise.resolve({})]);
 return <StrikShell wide><div className={styles.page}><CloseWizard id={id} year={year} outstanding={seasonSummary(sources,central).outstanding} resuming={season.state==="closing"} initialNotes={season.closure_notes}/></div></StrikShell>;
}
