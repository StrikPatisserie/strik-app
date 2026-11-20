import {redirect} from "next/navigation";
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;jaar?:string}>}){const q=await searchParams;const query=new URLSearchParams({seizoen:"sint",...(q.q?{q:q.q}:{}),...(q.jaar?{jaar:q.jaar}:{})});redirect(`/feestdagen/bedrijven?${query}`);}
