"use client";
import {useEffect,useState} from "react";
import {HOME_REVENUE_SHOPS,revenueDateLabel,type HomeDayRevenue} from "./management/homeDayRevenue";
const money = new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"});
const exactMoney = new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"});
const indexFormat = new Intl.NumberFormat("nl-NL",{maximumFractionDigits:1});

export default function HomeDayRevenue() {
  const [data,setData]=useState<HomeDayRevenue|null>(null);
  const [now,setNow]=useState<Date|null>(null);
  const [unavailable,setUnavailable]=useState(false);
  const [denied,setDenied]=useState(false);
  const [comparison,setComparison]=useState<"week"|"year">("week");
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
  const hasYearComparison=data?.shops.some(row=>row.year?.amount!=null);
  const comparisonLabel=comparison==="year"?"vorig jaar":"vorige week";
  return <section aria-label="Dagomzet winkels" className="mt-5 max-w-2xl border-y border-[#60705a]/20 py-3">
    <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.62rem] text-[#60705a]">
      <h2 className="font-bold uppercase tracking-[0.12em]">Dagomzet</h2>
      {dateLabel&&<span>{dateLabel}</span>}
      {hasYearComparison?<label className="ml-auto flex items-center gap-1">Index t.o.v.<select className="bg-transparent text-inherit outline-offset-2" aria-label="Omzetindex vergelijken met" value={comparison} onChange={event=>setComparison(event.target.value as "week"|"year")}><option value="week">vorige week</option><option value="year">vorig jaar</option></select></label>:<span className="ml-auto">Index t.o.v. vorige week</span>}
      {unavailable&&<span role="status">{data?"Bijwerken lukt even niet":"Tijdelijk niet beschikbaar"}</span>}
    </div>
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
      {HOME_REVENUE_SHOPS.map(shop=>{
        const row=data?.shops.find(item=>item.shop===shop);
        const differentDay=row?.date&&row.date!==data?.date;
        const reference=row?.[comparison];
        const index=reference?.index;
        const referenceDate=reference&&now?revenueDateLabel(reference.date,now):"";
        const indexDescription=index!=null?`Index ${indexFormat.format(index)} t.o.v. ${comparisonLabel}: ${referenceDate}, ${money.format(reference!.amount!)}. 100 is gelijk.`:reference?.amount===0?"Geen index: de vergelijkingsdag had nul omzet.":`Geen dagomzet beschikbaar voor ${referenceDate || comparisonLabel}.`;
        return <div key={shop} className="min-w-0"><dt className="text-[0.64rem] text-[#60705a]">{shop}</dt><dd className="mt-0.5 text-base font-bold tabular-nums leading-tight text-[#49342d]" title={row?.amount!=null?exactMoney.format(row.amount):"Rapport nog niet ontvangen"}>{row?.amount!=null?money.format(row.amount):"—"}{row?.amount!=null&&<span title={indexDescription} aria-label={indexDescription} className={`ml-1.5 inline-block rounded-full px-1.5 py-0.5 align-middle text-[0.58rem] font-semibold ${index==null||index===100?"bg-white/30 text-[#60705a]":index>100?"bg-[#edf3e5] text-[#315641]":"bg-[#f7e7df] text-[#a23e2b]"}`}>{index!=null?indexFormat.format(index):"—"}</span>}</dd>{differentDay&&now?<p className="mt-0.5 text-[0.55rem] text-[#60705a]">{revenueDateLabel(row.date!,now)}</p>:!row?.date&&data?<p className="mt-0.5 text-[0.55rem] text-[#60705a]">Nog geen rapport</p>:null}</div>;
      })}
    </dl>
  </section>;
}
