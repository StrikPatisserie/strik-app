"use client";
import {useEffect,useState} from "react";
import {HOME_REVENUE_SHOPS,revenueDateLabel,type HomeDayRevenue} from "./management/homeDayRevenue";
const money = new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"});
const exactMoney = new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"});

export default function HomeDayRevenue() {
  const [data,setData]=useState<HomeDayRevenue|null>(null);
  const [now,setNow]=useState<Date|null>(null);
  const [unavailable,setUnavailable]=useState(false);
  const [denied,setDenied]=useState(false);
  useEffect(()=>{
    let active=true,loading=false;
    let controller:AbortController|null=null;
    async function refresh(){
      if (document.visibilityState === "hidden" || loading) return;
      loading=true;setNow(new Date());controller=new AbortController();
      const timeout=window.setTimeout(()=>controller?.abort(),15000);
      try {
        const response=await fetch("/api/home-day-revenue",{cache:"no-store",signal:controller.signal});
        if (!active) return;
        if (response.status===401||response.status===403){setDenied(true);setData(null);return;}
        if (!response.ok) throw Error("unavailable");
        const next=await response.json() as HomeDayRevenue;
        if (active) {setData(next);setUnavailable(false);}
      } catch {if(active)setUnavailable(true);}
      finally {window.clearTimeout(timeout);loading=false;}
    }
    void refresh();
    const interval=window.setInterval(()=>{setNow(new Date());void refresh();},60000);
    const focus=()=>void refresh();
    window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);
    return()=>{active=false;controller?.abort();window.clearInterval(interval);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);};
  },[]);
  if(denied)return null;
  const dateLabel=data?.date&&now?revenueDateLabel(data.date,now):"";
  return <section aria-label="Dagomzet winkels" className="mt-5 max-w-2xl border-y border-[#60705a]/20 py-3">
    <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.62rem] text-[#60705a]">
      <h2 className="font-bold uppercase tracking-[0.12em]">Dagomzet</h2>
      {dateLabel&&<span>{dateLabel}</span>}
      {unavailable&&<span role="status">{data?"Bijwerken lukt even niet":"Tijdelijk niet beschikbaar"}</span>}
    </div>
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
      {HOME_REVENUE_SHOPS.map(shop=>{
        const row=data?.shops.find(item=>item.shop===shop);
        const differentDay=row?.date&&row.date!==data?.date;
        return <div key={shop} className="min-w-0"><dt className="text-[0.64rem] text-[#60705a]">{shop}</dt><dd className="mt-0.5 text-base font-bold tabular-nums leading-tight text-[#49342d]" title={row?.amount!=null?exactMoney.format(row.amount):"Rapport nog niet ontvangen"}>{row?.amount!=null?money.format(row.amount):"—"}</dd>{differentDay&&now?<p className="mt-0.5 text-[0.55rem] text-[#60705a]">{revenueDateLabel(row.date!,now)}</p>:!row?.date&&data?<p className="mt-0.5 text-[0.55rem] text-[#60705a]">Nog geen rapport</p>:null}</div>;
      })}
    </dl>
  </section>;
}
