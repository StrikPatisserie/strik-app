import {notFound} from "next/navigation";
import {StrikShell} from "../../../StrikUI";
import {requireAdminProfile} from "../../../lib/auth/session";
import {getSeason,getPreviousArchive} from "../../server";
import {amsterdamYear,holiday,emptyConfig} from "../../model";
import StartWizard from "../../StartWizard";
import styles from "../../Feestdagen.module.css";
export const dynamic="force-dynamic";
export default async function StartPage({params,searchParams}:{params:Promise<{season:string}>;searchParams:Promise<{jaar?:string}>}){
 const profile=await requireAdminProfile(),{season:id}=await params,query=await searchParams,h=holiday(id);if(!h)notFound();
 const year=/^20\d{2}$/.test(query.jaar||"")?Number(query.jaar):amsterdamYear(),[existing,previous]=await Promise.all([getSeason(id,year),getPreviousArchive(id,year)]);
 const initial=existing?.state==="opening"?existing.config:{...emptyConfig(year),owner:profile.full_name||"",letters:id==="sint",business:["sint","kerst"].includes(id),mailing:["sint","kerst"].includes(id),assortment:previous?.config.assortment||"",instructions:previous?.notes.next||""};
 return <StrikShell wide><div className={styles.page}><StartWizard id={id} year={year} initial={initial} previousTips={previous?.notes.next||""} resuming={existing?.state==="opening"}/></div></StrikShell>;
}
