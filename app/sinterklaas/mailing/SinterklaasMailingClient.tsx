"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type SendKind = "folder" | "reminder1" | "reminder2";
type Recipient = {
  id: string;
  contactName: string;
  email: string;
  doNotEmail: boolean;
  sent: { kind: SendKind; sentAt: string }[];
};
type Customer = {
  id: string;
  company: string;
  notes: string;
  recipients: Recipient[];
  ordered?: boolean;
  orderedAt?: string;
};
type Campaign = {
  year: string;
  subject: string;
  body: string;
  reminder1Subject: string;
  reminder1Body: string;
  reminder2Subject: string;
  reminder2Body: string;
  folderUrl: string;
  customers: Customer[];
  mailTemplateVersion?: string;
};
type PendingMail = {
  customerIds: string[];
  kind: SendKind;
  subject: string;
  body: string;
  phase: "resend" | "choice" | "edit" | "confirm";
  includePreviouslySent: boolean;
};
type TemplateConfig = {
  label: string;
  shortLabel: string;
  subjectKey: "subject" | "reminder1Subject" | "reminder2Subject";
  bodyKey: "body" | "reminder1Body" | "reminder2Body";
};

const year = String(new Date().getFullYear());
const LEGACY_DIGITAL_FOLDER_URL = "https://strik-app.vercel.app/sint-voor-bedrijven";
const DIGITAL_FOLDER_URL = "https://app.strik-patisserie.nl/sint-voor-bedrijven";
const defaults: Campaign = {
  year,
  subject: "De digitale Sinterklaasfolder voor bedrijven | Strik Patisserie",
  body: "Beste {{contactpersoon}},\n\nOnze zakelijke Sinterklaasfolder staat online. Bekijk op één plek het assortiment, de actuele prijzen en staffels en stel gemakkelijk een vrijblijvende offerteaanvraag samen.\n\nGeen PDF of bijlage: via de knop in deze e-mail open je rechtstreeks onze folder.\n\nHeb je een vraag of wil je samen iets passends samenstellen? Antwoord gerust op deze e-mail; we denken graag met je mee.\n\nMet feestelijke groet,\nTeam Strik Patisserie",
  reminder1Subject: "Al een Sinterklaascadeau voor je team gevonden? | Strik Patisserie",
  reminder1Body: "Beste {{contactpersoon}},\n\nHeb je onze digitale Sinterklaasfolder al kunnen bekijken? Je ziet er direct welke cadeaus binnen je budget passen, inclusief staffels en personalisatiemogelijkheden.\n\nVia de folder stel je vrijblijvend een offerteaanvraag samen. Natuurlijk kun je ook op deze e-mail antwoorden als je liever persoonlijk overlegt.\n\nMet feestelijke groet,\nTeam Strik Patisserie",
  reminder2Subject: "Laatste moment voor zakelijke Sinterklaasbestellingen | Strik Patisserie",
  reminder2Body: "Beste {{contactpersoon}},\n\nEen vriendelijke laatste herinnering voor onze zakelijke Sinterklaascadeaus. Wil je nog iets bestellen voor collega’s of relaties? Bekijk dan de digitale folder en stuur tijdig je vrijblijvende aanvraag in.\n\nWe bevestigen beschikbaarheid en het gewenste levermoment altijd persoonlijk.\n\nMet feestelijke groet,\nTeam Strik Patisserie",
  folderUrl: DIGITAL_FOLDER_URL,
  customers: [],
};
const templateConfig: Record<SendKind, TemplateConfig> = {
  folder: {
    label: "Eerste nieuwsbrief",
    shortLabel: "Nieuwsbrief",
    subjectKey: "subject",
    bodyKey: "body",
  },
  reminder1: {
    label: "Eerste herinnering",
    shortLabel: "Reminder 1",
    subjectKey: "reminder1Subject",
    bodyKey: "reminder1Body",
  },
  reminder2: {
    label: "Laatste herinnering",
    shortLabel: "Reminder 2",
    subjectKey: "reminder2Subject",
    bodyKey: "reminder2Body",
  },
};

async function api(method = "GET", body?: unknown) {
  const response = await fetch(`/api/sinterklaas-mailing?year=${year}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Mailing kon niet worden verwerkt.");
  return data as Partial<Campaign> & { needsImport?: boolean };
}

function stamp(recipient: Recipient, kind: SendKind) {
  for (let index = recipient.sent.length - 1; index >= 0; index -= 1) {
    if (recipient.sent[index].kind === kind) return recipient.sent[index].sentAt;
  }
  return "";
}

function sentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function validFolderUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function folderHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "ongeldige link";
  }
}

function migrateCampaign(data: Partial<Campaign>) {
  const customers = Array.isArray(data.customers) ? data.customers : [];
  const hasLegacyPdf = !data.folderUrl || /\.pdf(?:$|[?#])/i.test(data.folderUrl);
  const mentionsLegacyAttachment = /\bin de bijlage\b|\b(?:pdf|folder) als bijlage\b/i.test(data.body || "");
  const hasLegacyVercelUrl = data.folderUrl?.replace(/\/+$/, "") === LEGACY_DIGITAL_FOLDER_URL;
  const modernizeBody = (value: string) => value
    .replaceAll("onze interactieve folder", "onze folder")
    .replaceAll("Met vriendelijke groet,", "Met feestelijke groet,");
  if (hasLegacyPdf || mentionsLegacyAttachment) {
    return { campaign: { ...defaults, customers }, migrated: true };
  }
  const loaded = { ...defaults, ...data, customers } as Campaign;
  const campaign = {
    ...loaded,
    folderUrl: hasLegacyVercelUrl ? DIGITAL_FOLDER_URL : loaded.folderUrl,
    body: modernizeBody(loaded.body),
    reminder1Body: modernizeBody(loaded.reminder1Body),
    reminder2Body: modernizeBody(loaded.reminder2Body),
  };
  return {
    campaign,
    migrated: campaign.folderUrl !== loaded.folderUrl || campaign.body !== loaded.body || campaign.reminder1Body !== loaded.reminder1Body || campaign.reminder2Body !== loaded.reminder2Body,
  };
}

function MailIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>;
}

function ShieldIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></svg>;
}

function LinkIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/></svg>;
}

function EmailPreview({ subject, body, folderUrl }: Readonly<{ subject: string; body: string; folderUrl: string }>) {
  const previewBody = body.replaceAll("{{contactpersoon}}", "Sanne");
  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-[#e6d6b7] bg-[#f5f1e9] shadow-sm">
      <div className="border-b border-[#ddd3c5] bg-white px-4 py-3 text-[.68rem] leading-relaxed text-[#6e665e]">
        <p><strong className="text-[#2b2723]">Van:</strong> Strik Patisserie &lt;info@strik-patisserie.nl&gt;</p>
        <p><strong className="text-[#2b2723]">Aan:</strong> iedere ontvanger afzonderlijk</p>
        <p className="truncate"><strong className="text-[#2b2723]">Onderwerp:</strong> {subject || "Nog geen onderwerp"}</p>
      </div>
      <div className="bg-[#efb800] px-5 py-5 text-[#5a170f]">
        <div className="flex items-center gap-3">
          <Image src="/strik-logo.png" alt="" width={72} height={48} className="h-9 w-auto object-contain" />
          <div>
            <p className="text-[.58rem] font-black uppercase tracking-[.2em] text-white">Zakelijk Sinterklaas 2026</p>
            <p className="font-[Butterscotch] text-3xl leading-none text-[#d62d1d]">Met een Strik</p>
          </div>
        </div>
      </div>
      <div className="bg-white px-5 py-6">
        <div className="space-y-3 text-sm font-medium leading-relaxed text-[#4d4039]">
          {previewBody.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => (
            <p key={`${paragraph.slice(0, 18)}-${index}`} className="whitespace-pre-line">{paragraph}</p>
          ))}
        </div>
        <a href={validFolderUrl(folderUrl) ? folderUrl : undefined} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-full bg-[#d62d1d] px-5 py-3 text-sm font-black text-white shadow-md">
          Bekijk de folder →
        </a>
      </div>
      <div className="bg-[#5a170f] px-5 py-4 text-[.62rem] leading-relaxed text-[#f9e7cd]">
        Strik Patisserie · Nijmegen · info@strik-patisserie.nl<br />Geen zakelijke Sinterklaasmail meer? Antwoord met ‘afmelden’.
      </div>
    </div>
  );
}

export default function SinterklaasMailingClient() {
  const [campaign, setCampaign] = useState<Campaign>(defaults);
  const [message, setMessage] = useState("Mailing laden...");
  const [saving, setSaving] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingMail | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<SendKind>("folder");
  const [importOpen, setImportOpen] = useState(false);
  const [bulkAddresses, setBulkAddresses] = useState("");

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return campaign.customers.filter((customer) =>
      `${customer.company} ${customer.notes} ${customer.recipients.map((recipient) => `${recipient.contactName} ${recipient.email}`).join(" ")}`
        .toLowerCase()
        .includes(query)
    );
  }, [campaign.customers, search]);

  useEffect(() => {
    void api()
      .then(async (data) => {
        const { campaign: loaded, migrated } = migrateCampaign(data);
        setCampaign(loaded);
        if (!data.needsImport && !migrated) {
          setMessage("");
          return;
        }
        setMessage(data.needsImport ? "Klantenlijst centraal opslaan..." : "");
        const saved = await api("POST", loaded);
        setCampaign({ ...loaded, ...saved } as Campaign);
        setMessage(data.needsImport ? `${loaded.customers.length} klanten zijn centraal opgeslagen.` : "");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Mailing laden mislukt."));
  }, []);

  const patch = (value: Partial<Campaign>) => setCampaign((current) => ({ ...current, ...value }));
  const patchCustomer = (id: string, value: Partial<Customer>) => patch({ customers: campaign.customers.map((customer) => customer.id === id ? { ...customer, ...value } : customer) });
  const patchRecipient = (customerId: string, recipientId: string, value: Partial<Recipient>) => patch({ customers: campaign.customers.map((customer) => customer.id === customerId ? { ...customer, recipients: customer.recipients.map((recipient) => recipient.id === recipientId ? { ...recipient, ...value } : recipient) } : customer) });

  async function save(closeAfter = "") {
    if (!validFolderUrl(campaign.folderUrl)) {
      setMessage("Vul eerst een geldige https-link naar de digitale folder in.");
      return;
    }
    setSaving(true);
    try {
      const data = await api("POST", campaign);
      setCampaign({ ...campaign, ...data } as Campaign);
      if (closeAfter) setExpanded("");
      setMessage("Klantenlijst en digitale mailing zijn opgeslagen in WordPress.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  function addCustomer() {
    const id = `klant-${Date.now()}`;
    patch({ customers: [{ id, company: "", notes: "", recipients: [{ id: `adres-${Date.now()}`, contactName: "", email: "", doNotEmail: false, sent: [] }] }, ...campaign.customers] });
    setExpanded(id);
  }

  function addRecipient(customer: Customer) {
    patchCustomer(customer.id, { recipients: [...customer.recipients, { id: `adres-${Date.now()}`, contactName: "", email: "", doNotEmail: false, sent: [] }] });
  }

  function recipientsFor(customer: Customer, kind: SendKind, includePreviouslySent = false) {
    if (customer.ordered) return [];
    return customer.recipients.filter((recipient) =>
      recipient.email &&
      !recipient.doNotEmail &&
      (includePreviouslySent || !stamp(recipient, kind)) &&
      (kind === "folder" || Boolean(stamp(recipient, kind === "reminder1" ? "folder" : "reminder1")))
    );
  }

  function beginMail(customerIds: string[], kind: SendKind) {
    if (!validFolderUrl(campaign.folderUrl)) {
      setMessage("De digitale folderlink is ongeldig. Controleer de link voordat je verstuurt.");
      return;
    }
    const config = templateConfig[kind];
    const hasPreviouslySent = kind === "folder" && campaign.customers.some((customer) =>
      customerIds.includes(customer.id) && recipientsFor(customer, kind, true).some((recipient) => Boolean(stamp(recipient, kind)))
    );
    setPending({
      customerIds,
      kind,
      subject: campaign[config.subjectKey],
      body: campaign[config.bodyKey],
      phase: hasPreviouslySent ? "resend" : "choice",
      includePreviouslySent: hasPreviouslySent,
    });
  }

  async function sendPending() {
    if (!pending) return;
    const customers = campaign.customers.filter((customer) => pending.customerIds.includes(customer.id) && recipientsFor(customer, pending.kind, pending.includePreviouslySent).length);
    const jobs = customers.flatMap((customer) => recipientsFor(customer, pending.kind, pending.includePreviouslySent).map((recipient) => ({ customer, recipient })));
    if (!jobs.length) {
      setPending(null);
      return;
    }
    setSaving(true);
    setSendProgress(0);
    let current = campaign;
    let completed = 0;
    try {
      for (const job of jobs) {
        const data = await api("PATCH", {
          year,
          customerId: job.customer.id,
          recipientId: job.recipient.id,
          kind: pending.kind,
          subject: pending.subject,
          body: pending.body,
          campaign: current,
        });
        current = { ...current, ...data } as Campaign;
        completed += 1;
        setCampaign(current);
        setSendProgress(completed);
      }
      setSelected([]);
      setMessage(`${templateConfig[pending.kind].shortLabel} privé verstuurd naar ${jobs.length} adres${jobs.length === 1 ? "" : "sen"} van ${customers.length} klant${customers.length === 1 ? "" : "en"}.`);
      setPending(null);
    } catch (error) {
      setMessage(`${completed} van ${jobs.length} mails verstuurd. ${error instanceof Error ? error.message : "Versturen mislukt."}`);
    } finally {
      setSaving(false);
      setSendProgress(0);
    }
  }

  function importBulkAddresses() {
    const existing = new Set(campaign.customers.flatMap((customer) => customer.recipients.map((recipient) => recipient.email.trim().toLowerCase())).filter(Boolean));
    const created: Customer[] = [];
    let skipped = 0;
    for (const [index, rawLine] of bulkAddresses.split(/\r?\n/).entries()) {
      const line = rawLine.trim();
      if (!line) continue;
      const email = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || "";
      if (!email || existing.has(email)) {
        skipped += 1;
        continue;
      }
      const parts = line.replace(email, "").split(/[;\t,]/).map((part) => part.trim()).filter(Boolean);
      const id = `import-${Date.now()}-${index}`;
      created.push({
        id,
        company: parts[0] || email.split("@")[1],
        notes: "Toegevoegd via snelle invoer",
        recipients: [{ id: `${id}-adres`, contactName: parts[1] || "", email, doNotEmail: false, sent: [] }],
      });
      existing.add(email);
    }
    if (!created.length) {
      setMessage("Geen nieuwe geldige e-mailadressen gevonden.");
      return;
    }
    patch({ customers: [...created, ...campaign.customers] });
    setSelected((current) => Array.from(new Set([...current, ...created.map((customer) => customer.id)])));
    setBulkAddresses("");
    setImportOpen(false);
    setMessage(`${created.length} nieuw${created.length === 1 ? "" : "e"} adres${created.length === 1 ? "" : "sen"} toegevoegd en geselecteerd${skipped ? `; ${skipped} dubbel of ongeldig overgeslagen` : ""}. Sla de wijzigingen nog op.`);
  }

  const activeConfig = templateConfig[activeTemplate];
  const activeSubject = campaign[activeConfig.subjectKey];
  const activeBody = campaign[activeConfig.bodyKey];
  const pendingCustomers = pending ? campaign.customers.filter((customer) => pending.customerIds.includes(customer.id) && recipientsFor(customer, pending.kind, pending.includePreviouslySent).length) : [];
  const pendingAddressCount = pending ? pendingCustomers.reduce((total, customer) => total + recipientsFor(customer, pending.kind, pending.includePreviouslySent).length, 0) : 0;
  const pendingUnsentAddressCount = pending ? campaign.customers.reduce((total, customer) => total + (pending.customerIds.includes(customer.id) ? recipientsFor(customer, pending.kind).length : 0), 0) : 0;
  const pendingPreviouslySent = pending?.kind === "folder" ? campaign.customers.flatMap((customer) =>
    pending.customerIds.includes(customer.id)
      ? recipientsFor(customer, "folder", true)
        .filter((recipient) => Boolean(stamp(recipient, "folder")))
        .map((recipient) => ({ customer: customer.company, recipient, sentAt: stamp(recipient, "folder") }))
      : []
  ) : [];
  const addressCount = campaign.customers.reduce((total, customer) => total + customer.recipients.length, 0);
  const allowedAddressCount = campaign.customers.reduce((total, customer) => total + customer.recipients.filter((recipient) => recipient.email && !recipient.doNotEmail).length, 0);
  const sentAddressCount = campaign.customers.reduce((total, customer) => total + customer.recipients.filter((recipient) => stamp(recipient, "folder")).length, 0);
  const allShownSelected = shown.length > 0 && shown.every((customer) => selected.includes(customer.id));

  return (
    <div className="space-y-5">
      {message && <div role="status" className="rounded-xl border border-[#e7c978] bg-[#fff8df] px-4 py-3 text-sm font-bold text-[#692115]">{message}</div>}

      <section className="relative overflow-hidden rounded-[1.6rem] bg-[#efb800] p-4 text-[#5a170f] shadow-[0_12px_35px_rgba(94,47,7,.12)] sm:px-5">
        <span className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full bg-[#d62d1d]/14" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/90 shadow-sm"><Image src="/strik-logo.png" alt="Strik Patisserie" width={72} height={48} className="h-9 w-auto object-contain" /></div>
            <div>
              <p className="text-[.58rem] font-black uppercase tracking-[.2em] text-white">B2B-mailing {campaign.year}</p>
              <h2 className="mt-0.5 text-xl font-black sm:text-2xl">Sinterklaasnieuwsbrief</h2>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-center">
            {[["Klanten", campaign.customers.length], ["Verstuurd", sentAddressCount]].map(([label, value]) => <div key={label} className="min-w-24 rounded-xl bg-white/92 px-3 py-2 shadow-sm"><p className="text-[.54rem] font-black uppercase tracking-wider text-[#9a4d35]">{label}</p><p className="text-xl font-black leading-tight">{value}</p></div>)}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[#e5ddd1] bg-white px-3 py-2.5 text-[.68rem] font-black text-[#635a52] shadow-sm">
        <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#edf5ea] text-[#31552a]"><ShieldIcon /></span>Privé per adres</span>
        <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff4d1] text-[#b14925]"><LinkIcon /></span>Actuele folderlink</span>
        <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff0ec] text-[#d62d1d]"><MailIcon /></span>Antwoorden naar info@strik-patisserie.nl</span>
        <span className="ml-auto text-[#857a70]">{allowedAddressCount} mailbaar</span>
      </section>

      <section className="rounded-[1.6rem] border border-[#e5ddd1] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[#d62d1d]">Campagne-instellingen</p><h2 className="mt-0.5 text-xl font-black">Digitale nieuwsbrief</h2></div>
          <button type="button" className="allergen-small-button bg-[#31552a] text-white" disabled={saving} onClick={() => void save()}>{saving ? "Opslaan..." : "Campagne opslaan"}</button>
        </div>
        <div className="mt-4 rounded-2xl border border-[#ead7b4] bg-[#fffaf0] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1 text-xs font-black text-[#5a170f]">Link naar interactieve B2B-folder<input className={`allergen-input mt-1 ${validFolderUrl(campaign.folderUrl) ? "border-[#9bc2a2]" : "border-red-400"}`} value={campaign.folderUrl} onChange={(event) => patch({ folderUrl: event.target.value })} placeholder={DIGITAL_FOLDER_URL} /></label>
            <a href={validFolderUrl(campaign.folderUrl) ? campaign.folderUrl : undefined} target="_blank" rel="noreferrer" aria-disabled={!validFolderUrl(campaign.folderUrl)} className={`allergen-small-button text-center ${validFolderUrl(campaign.folderUrl) ? "bg-[#d62d1d] text-white" : "pointer-events-none opacity-40"}`}>Folder controleren ↗</a>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[.68rem] font-bold text-[#55715c]"><ShieldIcon /> Veilige https-link naar {folderHost(campaign.folderUrl)} · geen PDF-bijlage</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Mailtype kiezen">
          {(Object.keys(templateConfig) as SendKind[]).map((kind) => <button key={kind} type="button" role="tab" aria-selected={activeTemplate === kind} onClick={() => setActiveTemplate(kind)} className={`rounded-full px-4 py-2 text-xs font-black transition ${activeTemplate === kind ? "bg-[#d62d1d] text-white shadow-sm" : "bg-[#f4eee5] text-[#6b4d43] hover:bg-[#eee4d7]"}`}>{templateConfig[kind].label}</button>)}
        </div>

        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(23rem,.78fr)]">
          <div>
            <label className="block text-xs font-black">Onderwerp<input className="allergen-input mt-1" value={activeSubject} onChange={(event) => patch({ [activeConfig.subjectKey]: event.target.value })} /></label>
            <label className="mt-3 block text-xs font-black">Mailtekst<textarea className="allergen-input mt-1 min-h-72 resize-y leading-relaxed" value={activeBody} onChange={(event) => patch({ [activeConfig.bodyKey]: event.target.value })} /></label>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[.68rem] text-[#716a62]"><p>Gebruik <strong>{"{{contactpersoon}}"}</strong> voor een persoonlijke aanhef.</p><p>Knop, betrouwbare link en afmeldtekst worden automatisch toegevoegd.</p></div>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[.62rem] font-black uppercase tracking-[.15em] text-[#8b7164]">Inboxvoorbeeld</p>
              <span className={`rounded-full px-2.5 py-1 text-[.58rem] font-black ${campaign.mailTemplateVersion === "strik-html-v4" ? "bg-[#e9f4e6] text-[#31552a]" : "bg-[#fff1d1] text-[#8a4d14]"}`}>
                {campaign.mailTemplateVersion === "strik-html-v4" ? "Opgemaakte mail actief" : "Mailtemplate nog bijwerken in WordPress"}
              </span>
            </div>
            <EmailPreview subject={activeSubject} body={activeBody} folderUrl={campaign.folderUrl} />
          </div>
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-[#e5ddd1] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[#31552a]">Verzendlijst</p><h2 className="mt-0.5 text-xl font-black">Klanten en e-mailadressen</h2><p className="mt-1 text-sm text-[#716a62]">{campaign.customers.length} klanten · {addressCount} adressen · bestelde klanten worden automatisch overgeslagen</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" className="allergen-small-button" onClick={() => setImportOpen((open) => !open)}>+ Meerdere adressen</button><button type="button" className="allergen-small-button" onClick={addCustomer}>+ Klant</button><button type="button" className="allergen-small-button bg-[#31552a] text-white" disabled={saving} onClick={() => void save()}>{saving ? "Opslaan..." : "Wijzigingen opslaan"}</button></div>
        </div>

        {importOpen && <div className="mt-4 rounded-2xl border border-[#d6e5d8] bg-[#f6faf4] p-4"><div className="flex flex-col gap-3 lg:flex-row"><label className="min-w-0 flex-1 text-xs font-black">Plak meerdere adressen<textarea value={bulkAddresses} onChange={(event) => setBulkAddresses(event.target.value)} className="allergen-input mt-1 min-h-28 resize-y" placeholder={"Bedrijfsnaam; Contactpersoon; mail@bedrijf.nl\nAnder bedrijf; Naam; ander@bedrijf.nl\nof alleen: mail@bedrijf.nl"} /></label><div className="flex shrink-0 items-end gap-2"><button type="button" className="allergen-small-button" onClick={() => { setImportOpen(false); setBulkAddresses(""); }}>Annuleren</button><button type="button" className="allergen-small-button bg-[#31552a] text-white" onClick={importBulkAddresses}>Toevoegen en selecteren</button></div></div><p className="mt-2 text-[.68rem] text-[#647068]">Dubbele en ongeldige adressen worden automatisch overgeslagen.</p></div>}

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#d6e5d8] bg-[#f6faf4] p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 px-1 text-sm font-black"><input type="checkbox" checked={allShownSelected} onChange={(event) => setSelected(event.target.checked
            ? Array.from(new Set([...selected, ...shown.map((customer) => customer.id)]))
            : selected.filter((id) => !shown.some((customer) => customer.id === id))
          )} /> Alles in beeld</label><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#31552a]">{selected.length} geselecteerd</span>{selected.length > 0 && <button type="button" className="text-xs font-bold text-[#716a62] underline" onClick={() => setSelected([])}>Selectie wissen</button>}</div>
          <div className="flex flex-wrap gap-2"><button type="button" className="allergen-small-button bg-[#d62d1d] text-white" disabled={!campaign.customers.some((customer) => selected.includes(customer.id) && recipientsFor(customer, "folder", true).length)} onClick={() => beginMail(selected, "folder")}>Nieuwsbrief versturen</button><button type="button" className="allergen-small-button" disabled={!campaign.customers.some((customer) => selected.includes(customer.id) && recipientsFor(customer, "reminder1").length)} onClick={() => beginMail(selected, "reminder1")}>Reminder 1</button><button type="button" className="allergen-small-button" disabled={!campaign.customers.some((customer) => selected.includes(customer.id) && recipientsFor(customer, "reminder2").length)} onClick={() => beginMail(selected, "reminder2")}>Reminder 2</button></div>
        </div>

        <div className="mt-3 flex justify-end"><input className="allergen-input w-full sm:max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zoek bedrijf, contactpersoon of e-mail..." /></div>

        <div className="mt-3 overflow-x-auto"><div className="min-w-[1080px] border-t border-[#e5e0d9]">{shown.map((customer) => {
          const folderRecipients = recipientsFor(customer, "folder");
          const allFolderRecipients = recipientsFor(customer, "folder", true);
          const reminder1Recipients = recipientsFor(customer, "reminder1");
          const reminder2Recipients = recipientsFor(customer, "reminder2");
          return <article key={customer.id} className={`border-b border-[#e5e0d9] ${customer.ordered ? "bg-[#f5f7f3]" : ""}`}><div className="grid grid-cols-[auto_1.2fr_2fr_.8fr_2.2fr_auto] items-center gap-2 px-2 py-2 text-sm"><input aria-label={`${customer.company} selecteren`} type="checkbox" checked={selected.includes(customer.id)} onChange={(event) => setSelected((current) => event.target.checked ? Array.from(new Set([...current, customer.id])) : current.filter((id) => id !== customer.id))} /><strong>{customer.company || "Nieuwe klant"}</strong><span className="truncate text-[#625c54]">{customer.recipients.map((recipient) => recipient.email).filter(Boolean).join(", ") || "Nog geen e-mailadres"}</span><label className="flex items-center gap-1 font-bold"><input type="checkbox" checked={Boolean(customer.ordered)} onChange={(event) => patchCustomer(customer.id, { ordered: event.target.checked, orderedAt: event.target.checked ? new Date().toISOString() : "" })} /> Besteld</label><div className="flex gap-1"><button type="button" className="allergen-small-button" disabled={!allFolderRecipients.length} onClick={() => beginMail([customer.id], "folder")}>{folderRecipients.length ? "Nieuwsbrief" : "Opnieuw versturen"}</button><button type="button" className="allergen-small-button" disabled={!reminder1Recipients.length} onClick={() => beginMail([customer.id], "reminder1")}>Reminder 1</button><button type="button" className="allergen-small-button" disabled={!reminder2Recipients.length} onClick={() => beginMail([customer.id], "reminder2")}>Reminder 2</button></div><button type="button" className="allergen-small-button" onClick={() => setExpanded(expanded === customer.id ? "" : customer.id)}>{expanded === customer.id ? "Sluiten" : "Bewerken"}</button></div>{expanded === customer.id && <div className="border-t border-[#eee9e2] bg-[#faf8f5] p-3"><div className="flex gap-2"><input className="allergen-input font-black" value={customer.company} onChange={(event) => patchCustomer(customer.id, { company: event.target.value })} placeholder="Bedrijfsnaam" /><button type="button" className="allergen-small-button" onClick={() => addRecipient(customer)}>+ E-mailadres</button><button type="button" className="px-2 text-sm font-bold text-red-700" onClick={() => patch({ customers: campaign.customers.filter((item) => item.id !== customer.id) })}>Klant verwijderen</button></div>{customer.recipients.map((recipient) => <div key={recipient.id} className="mt-2 grid grid-cols-[1fr_1.2fr_auto_auto] gap-2"><input className="allergen-input" value={recipient.contactName} onChange={(event) => patchRecipient(customer.id, recipient.id, { contactName: event.target.value })} placeholder="Contactpersoon" /><input className="allergen-input" type="email" value={recipient.email} onChange={(event) => patchRecipient(customer.id, recipient.id, { email: event.target.value })} placeholder="E-mailadres" /><label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={recipient.doNotEmail} onChange={(event) => patchRecipient(customer.id, recipient.id, { doNotEmail: event.target.checked })} /> Niet mailen</label><button type="button" className="text-sm font-bold text-red-700" onClick={() => patchCustomer(customer.id, { recipients: customer.recipients.filter((item) => item.id !== recipient.id) })}>Verwijder</button></div>)}<div className="mt-2 flex items-center gap-2"><input className="allergen-input" value={customer.notes} onChange={(event) => patchCustomer(customer.id, { notes: event.target.value })} placeholder="Notities" /><button type="button" className="allergen-small-button bg-[#31552a] text-white" disabled={saving} onClick={() => void save(customer.id)}>{saving ? "Opslaan..." : "Klant opslaan"}</button></div></div>}</article>;
        })}{!shown.length && <p className="p-4 text-sm text-[#777067]">Geen klanten gevonden.</p>}</div></div>
      </section>

      {pending && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2d140d]/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="mail-dialog-title" className="max-h-[94dvh] w-full max-w-2xl overflow-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[.62rem] font-black uppercase tracking-[.16em] text-[#d62d1d]">Privé verzenden</p><h2 id="mail-dialog-title" className="mt-1 text-2xl font-black">{templateConfig[pending.kind].label}</h2><p className="mt-1 text-sm font-bold text-[#716a62]">{pendingCustomers.length} klant{pendingCustomers.length === 1 ? "" : "en"} · {pendingAddressCount} afzonderlijke e-mail{pendingAddressCount === 1 ? "" : "s"}</p></div><button type="button" aria-label="Sluiten" onClick={() => setPending(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4eee5] text-lg font-black">×</button></div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#edf5ea] p-3 text-xs font-bold leading-relaxed text-[#31552a]"><ShieldIcon /><p>Elk adres ontvangt een eigen mail met persoonlijke aanhef. Ontvangers kunnen elkaars e-mailadres niet zien.</p></div>
        {pending.phase === "resend" && <>
          <div className="my-4 rounded-2xl border border-[#efc36c] bg-[#fff7dc] p-4 text-[#692115]">
            <p className="font-black">Nieuwsbrief al eerder verstuurd</p>
            <p className="mt-1 text-sm leading-relaxed">{pendingPreviouslySent.length} adres{pendingPreviouslySent.length === 1 ? " heeft" : "sen hebben"} deze nieuwsbrief al ontvangen. Weet je zeker dat je hem opnieuw wilt versturen?</p>
            <div className="mt-3 max-h-32 space-y-1 overflow-auto rounded-xl bg-white/70 p-3 text-xs">
              {pendingPreviouslySent.map(({ customer, recipient, sentAt }) => <p key={`${customer}-${recipient.id}`}><strong>{customer || recipient.email}</strong>{customer ? ` · ${recipient.email}` : ""}<span className="text-[#7d6e64]"> · {sentDate(sentAt)}</span></p>)}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="allergen-small-button" onClick={() => setPending(null)}>Annuleren</button>
            {pendingUnsentAddressCount > 0 && <button type="button" className="allergen-small-button" onClick={() => setPending({ ...pending, phase: "choice", includePreviouslySent: false })}>Alleen {pendingUnsentAddressCount} nog niet verstuurde</button>}
            <button type="button" className="allergen-small-button bg-[#d62d1d] text-white" onClick={() => setPending({ ...pending, phase: "choice", includePreviouslySent: true })}>Ja, opnieuw versturen</button>
          </div>
        </>}
        {pending.phase === "choice" && <><p className="my-5 font-bold">Wil je de standaardmail gebruiken of deze alleen voor deze verzending aanpassen?</p><div className="flex flex-wrap justify-end gap-2"><button type="button" className="allergen-small-button" onClick={() => setPending(null)}>Annuleren</button><button type="button" className="allergen-small-button" onClick={() => setPending({ ...pending, phase: "edit" })}>Mail aanpassen</button><button type="button" className="allergen-small-button bg-[#d62d1d] text-white" onClick={() => setPending({ ...pending, phase: "confirm" })}>Standaardmail gebruiken</button></div></>}
        {pending.phase === "edit" && <><label className="mt-4 block text-xs font-black">Onderwerp<input className="allergen-input mt-1" value={pending.subject} onChange={(event) => setPending({ ...pending, subject: event.target.value })} /></label><label className="mt-3 block text-xs font-black">Mailtekst<textarea className="allergen-input mt-1 min-h-64 resize-y" value={pending.body} onChange={(event) => setPending({ ...pending, body: event.target.value })} /></label><div className="mt-4 flex justify-end gap-2"><button type="button" className="allergen-small-button" onClick={() => setPending(null)}>Annuleren</button><button type="button" className="allergen-small-button bg-[#d62d1d] text-white" onClick={() => setPending({ ...pending, phase: "confirm" })}>Naar laatste controle</button></div></>}
        {pending.phase === "confirm" && <><div className="my-4 rounded-2xl border border-[#ead7b4] bg-[#fff8df] p-4"><p className="font-black">Laatste controle</p><p className="mt-1 text-sm">Je verstuurt {pendingAddressCount} persoonlijke mail{pendingAddressCount === 1 ? "" : "s"}. De digitale folderknop en afmeldtekst worden automatisch toegevoegd.</p><p className="mt-3 max-h-24 overflow-auto text-xs leading-relaxed text-[#716a62]">{pendingCustomers.map((customer) => customer.company).join(", ")}</p><p className="mt-3 border-t border-[#ead7b4] pt-3 text-sm font-black">{pending.subject}</p></div><div className="flex justify-end gap-2"><button type="button" className="allergen-small-button" disabled={saving} onClick={() => setPending(null)}>Annuleren</button><button type="button" className="allergen-small-button bg-[#d62d1d] text-white" disabled={saving || !pendingAddressCount} onClick={() => void sendPending()}>{saving ? `Versturen ${sendProgress}/${pendingAddressCount}...` : `Definitief naar ${pendingAddressCount} adres${pendingAddressCount === 1 ? "" : "sen"}`}</button></div></>}
      </section></div>}
    </div>
  );
}
