"use client";

import { useEffect, useMemo, useState } from "react";

type SendKind = "folder" | "reminder1" | "reminder2";
type Contact = { id:string; company:string; contactName:string; email:string; notes:string; doNotEmail:boolean; sent:{kind:SendKind;sentAt:string}[] };
type Campaign = { year:string; subject:string; body:string; reminder1Subject:string; reminder1Body:string; reminder2Subject:string; reminder2Body:string; folderUrl:string; contacts:Contact[] };

const year = String(new Date().getFullYear());
const emptyCampaign: Campaign = { year, subject:"Sinterklaas voor bedrijven bij Strik Patisserie", body:"Beste {{contactpersoon}},\n\nGraag delen wij onze Sinterklaasfolder voor bedrijven. In de bijlage vindt u ons assortiment.\n\nHeeft u vragen of wilt u bestellen? Reageer gerust op deze e-mail.\n\nMet vriendelijke groet,\nStrik Patisserie", reminder1Subject:"Herinnering: Sinterklaas voor bedrijven", reminder1Body:"Beste {{contactpersoon}},\n\nHeeft u onze Sinterklaasfolder al kunnen bekijken? We denken graag mee over een passende bestelling.\n\nMet vriendelijke groet,\nStrik Patisserie", reminder2Subject:"Laatste herinnering: Sinterklaas voor bedrijven", reminder2Body:"Beste {{contactpersoon}},\n\nDit is onze laatste herinnering voor het zakelijke Sinterklaasassortiment. Neem gerust contact met ons op als we iets kunnen betekenen.\n\nMet vriendelijke groet,\nStrik Patisserie", folderUrl:"", contacts:[] };

async function api(method="GET", body?:unknown) {
  const response = await fetch(`/api/sinterklaas-mailing?year=${year}`, { method, headers: body ? {"Content-Type":"application/json"} : undefined, body: body ? JSON.stringify(body) : undefined, cache:"no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Mailing kon niet worden verwerkt.");
  return data as Campaign;
}
const stamp = (contact:Contact, kind:SendKind) => contact.sent.find((item) => item.kind === kind)?.sentAt || "";
const formatDate = (value:string) => value ? new Date(value).toLocaleString("nl-NL", {dateStyle:"short",timeStyle:"short"}) : "–";

export default function SinterklaasMailingClient() {
  const [campaign,setCampaign] = useState<Campaign>(emptyCampaign);
  const [message,setMessage] = useState("Mailing laden...");
  const [saving,setSaving] = useState(false);
  const [search,setSearch] = useState("");
  const contacts = useMemo(() => campaign.contacts.filter((c) => `${c.company} ${c.contactName} ${c.email}`.toLowerCase().includes(search.toLowerCase())),[campaign.contacts,search]);
  useEffect(() => { void api().then((data) => { setCampaign({...emptyCampaign,...data,contacts:data.contacts || []}); setMessage(""); }).catch((e) => setMessage(e.message)); },[]);
  const patch = (value:Partial<Campaign>) => setCampaign((current) => ({...current,...value}));
  const patchContact = (id:string,value:Partial<Contact>) => patch({contacts:campaign.contacts.map((c) => c.id===id?{...c,...value}:c)});
  async function save() { setSaving(true); try { const saved=await api("POST",campaign); setCampaign(saved); setMessage("Mailing opgeslagen in WordPress."); } catch(e) { setMessage(e instanceof Error?e.message:"Opslaan mislukt."); } finally { setSaving(false); } }
  function addContact() { patch({contacts:[...campaign.contacts,{id:`contact-${Date.now()}`,company:"",contactName:"",email:"",notes:"",doNotEmail:false,sent:[]}]}); }
  async function send(contact:Contact,kind:SendKind) {
    if (!contact.email || contact.doNotEmail) return;
    const label=kind==="folder"?"de foldermail":kind==="reminder1"?"reminder 1":"reminder 2";
    if (!window.confirm(`${label} nu versturen naar ${contact.email}?`)) return;
    setSaving(true); try { const saved=await api("PATCH",{year,id:contact.id,action:"send",kind,campaign}); setCampaign(saved); setMessage(`${label} verstuurd naar ${contact.email}.`); } catch(e) { setMessage(e instanceof Error?e.message:"Versturen mislukt."); } finally { setSaving(false); }
  }
  return <div className="space-y-4">
    {message && <p className="rounded-lg border border-[#d6e5d8] bg-[#f6faf4] p-3 text-sm font-bold">{message}</p>}
    <section className="rounded-xl border border-[#d6e5d8] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><div><h2 className="text-xl font-black">Campagne {campaign.year}</h2><p className="text-sm text-[#716a62]">Afzender en reply-to: info@strik-patisserie.nl</p></div><button className="allergen-small-button bg-[#31552a] text-white" disabled={saving} onClick={()=>void save()}>{saving?"Bezig...":"Campagne opslaan"}</button></div>
      <label className="block text-xs font-black">Link naar B2B-folder (PDF)<input className="allergen-input mt-1" value={campaign.folderUrl} onChange={(e)=>patch({folderUrl:e.target.value})} placeholder="https://strik-patisserie.nl/.../folder.pdf" /></label>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">{([['subject','body','Eerste foldermail'],['reminder1Subject','reminder1Body','Reminder 1'],['reminder2Subject','reminder2Body','Reminder 2']] as const).map(([subject,body,label])=><div key={label} className="rounded-lg border border-[#e5e0d9] p-3"><h3 className="mb-2 font-black">{label}</h3><input className="allergen-input" value={campaign[subject]} onChange={(e)=>patch({[subject]:e.target.value})} aria-label={`Onderwerp ${label}`} /><textarea className="allergen-input mt-2 min-h-48 resize-y" value={campaign[body]} onChange={(e)=>patch({[body]:e.target.value})} aria-label={`Tekst ${label}`} /><p className="mt-1 text-[.68rem] text-[#777067]">Gebruik {'{{contactpersoon}}'} voor de aanhef.</p></div>)}</div>
    </section>
    <section className="rounded-xl border border-[#d6e5d8] bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-black">Bedrijven en contactpersonen</h2><p className="text-sm text-[#716a62]">{campaign.contacts.length} contacten</p></div><div className="flex gap-2"><input className="allergen-input max-w-xs" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Zoeken..."/><button className="allergen-small-button" onClick={addContact}>+ Contact toevoegen</button></div></div>
      <div className="space-y-3">{contacts.map((contact)=><article key={contact.id} className="rounded-lg border border-[#e5e0d9] p-3"><div className="grid gap-2 md:grid-cols-3"><input className="allergen-input font-bold" value={contact.company} onChange={(e)=>patchContact(contact.id,{company:e.target.value})} placeholder="Bedrijfsnaam"/><input className="allergen-input" value={contact.contactName} onChange={(e)=>patchContact(contact.id,{contactName:e.target.value})} placeholder="Contactpersoon"/><input className="allergen-input" type="email" value={contact.email} onChange={(e)=>patchContact(contact.id,{email:e.target.value})} placeholder="E-mailadres"/></div><div className="mt-2 flex flex-wrap items-center gap-2"><button className="allergen-small-button" disabled={saving||!!stamp(contact,'folder')||contact.doNotEmail} onClick={()=>void send(contact,'folder')}>{stamp(contact,'folder')?`Folder ${formatDate(stamp(contact,'folder'))}`:"Folder versturen"}</button><button className="allergen-small-button" disabled={saving||!stamp(contact,'folder')||!!stamp(contact,'reminder1')||contact.doNotEmail} onClick={()=>void send(contact,'reminder1')}>{stamp(contact,'reminder1')?`Reminder 1 ${formatDate(stamp(contact,'reminder1'))}`:"Reminder 1"}</button><button className="allergen-small-button" disabled={saving||!stamp(contact,'reminder1')||!!stamp(contact,'reminder2')||contact.doNotEmail} onClick={()=>void send(contact,'reminder2')}>{stamp(contact,'reminder2')?`Reminder 2 ${formatDate(stamp(contact,'reminder2'))}`:"Reminder 2"}</button><label className="ml-auto flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={contact.doNotEmail} onChange={(e)=>patchContact(contact.id,{doNotEmail:e.target.checked})}/> Niet meer mailen</label><button className="px-2 text-sm font-bold text-red-700" onClick={()=>patch({contacts:campaign.contacts.filter((c)=>c.id!==contact.id)})}>Verwijderen</button></div><input className="allergen-input mt-2" value={contact.notes} onChange={(e)=>patchContact(contact.id,{notes:e.target.value})} placeholder="Notities / reactie / afspraak"/></article>)}{!contacts.length&&<p className="text-sm text-[#777067]">Nog geen contacten gevonden.</p>}</div>
    </section>
  </div>;
}
