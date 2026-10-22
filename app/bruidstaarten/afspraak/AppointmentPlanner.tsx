"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { WeddingReceipt, WeddingSlotDay } from "../../lib/weddingAppointments";
import styles from "./AppointmentPlanner.module.css";

const weekdays = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const times = ["10:30", "11:30"];
const formatDate = (date: string) => new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const endTime = (time: string) => { const [hour, minute] = time.split(":").map(Number); return `${String(hour + Math.floor((minute + 30) / 60)).padStart(2, "0")}:${String((minute + 30) % 60).padStart(2, "0")}`; };

export default function AppointmentPlanner({ today, preview = true }: Readonly<{ today: string; preview?: boolean }>) {
  const [year, month] = today.split("-").map(Number);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [step, setStep] = useState<"choose" | "details" | "confirmed">("choose");
  const [contact, setContact] = useState({ names: "", email: "", phone: "", weddingDate: "", guests: "", notes: "" });
  const heading = useRef<HTMLHeadingElement>(null);
  const [availability, setAvailability] = useState<WeddingSlotDay[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [refresh, setRefresh] = useState(0);
  const [bookingError, setBookingError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<WeddingReceipt | null>(null);
  const [previewBookings, setPreviewBookings] = useState<{date: string; time: string}[]>([]);
  const submitting = useRef(false);
  const request = useRef<{key: string; id: string} | null>(null);
  const home = preview ? "/bruidstaarten/voorbeeld" : "/bruidstaart";
  const displayMonth = new Date(Date.UTC(year, month - 1 + monthOffset, 1, 12));
  const leading = (displayMonth.getUTCDay() + 6) % 7;
  const monthDays = new Date(Date.UTC(displayMonth.getUTCFullYear(), displayMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const from = dateKey(displayMonth);
  const to = dateKey(new Date(Date.UTC(displayMonth.getUTCFullYear(), displayMonth.getUTCMonth() + 1, 0, 12)));
  useEffect(() => {
    if (preview) return;
    const abort = new AbortController();
    setLoading(true);
    void fetch(`/api/wedding-appointments/availability?from=${from}&to=${to}`, {cache: "no-store", signal: abort.signal}).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "De vrije tijden konden niet worden geladen.");
      setAvailability(data.days || []);
      if (!data.enabled) setBookingError("Online boeken is op dit moment niet beschikbaar. Mail ons voor een afspraak.");
    }).catch(reason => { if (!abort.signal.aborted) { setAvailability([]); setBookingError(reason instanceof Error ? reason.message : "De vrije tijden konden niet worden geladen."); } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [from, to, preview, refresh]);
  const availableTimes = (date: string) => preview
    ? date > today && [2,3,4,5,6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? times.filter(time => !previewBookings.some(item => item.date === date && item.time === time)) : []
    : loading ? [] : availability.find(day => day.date === date)?.times || [];
  const selectedSummary = selectedDate && selectedTime ? `${formatDate(selectedDate)} · ${selectedTime}–${endTime(selectedTime)}` : "";
  const go = (next: typeof step) => { setStep(next); requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }); };
  const field = (key: keyof typeof contact, value: string) => setContact(current => ({ ...current, [key]: value }));

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !selectedDate || !selectedTime) return;
    if (preview) {
      setPreviewBookings(current => [...current, {date: selectedDate, time: selectedTime}]);
      go("confirmed");
      return;
    }
    submitting.current = true; setBusy(true); setBookingError("");
    const key = JSON.stringify({date: selectedDate, time: selectedTime, contact});
    if (request.current?.key !== key) request.current = {key, id: crypto.randomUUID()};
    try {
      const response = await fetch("/api/wedding-appointments/book", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({date: selectedDate, time: selectedTime, contact, requestId: request.current.id})});
      const data = await response.json();
      if (!response.ok || !data.receipt?.reference) {
        if (response.status === 409) { setSelectedTime(""); setRefresh(value => value + 1); go("choose"); }
        throw new Error(data.message || "De afspraak kon niet worden bevestigd. Probeer opnieuw.");
      }
      setReceipt(data.receipt); go("confirmed");
    } catch (reason) { setBookingError(reason instanceof TypeError ? "De verbinding is onderbroken. Probeer opnieuw; dezelfde afspraak wordt één keer geboekt." : reason instanceof Error ? reason.message : "De afspraak kon niet worden bevestigd."); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <div className={styles.page}>
    {preview && <div className={styles.preview}><strong>Ontwerpvoorbeeld</strong><span>Voorbeeldtijden · er wordt niets geboekt of gemaild</span></div>}
    <header className={styles.brandBar}><a href={home}><Image src="/strik-logo.png" alt="Strik Patisserie" width={76} height={76} /></a><span>Strik Patisserie · Nijmegen</span><a className={styles.homeBack} href={home}>← Terug naar bruidstaarten</a></header>
    <main className={styles.main}>
      <section className={styles.intro}><div><p className={styles.eyebrow}>Afspraak bij Strik</p><h1>Plan jullie<br /><em>bruidstaartafspraak.</em></h1><p>Bespreek het formaat, de smaken en de afwerking met ons. De afspraak duurt een halfuur en is vrijblijvend.</p></div><Image className={styles.cake} src="/icons_strik_bruidstaart.svg" alt="" width={140} height={140} /></section>
      <div className={styles.layout}>
        <aside className={styles.info}><p className={styles.eyebrow}>Bruidstaartgesprek</p><h2>De afspraak<br />in het kort.</h2><dl><div><dt>Waar</dt><dd>Strik Ziekerstraat<span>Ziekerstraat 124, Nijmegen</span></dd></div><div><dt>Duur</dt><dd>30 minuten<span>Een vrijblijvend gesprek</span></dd></div><div><dt>Na het boeken</dt><dd>Direct bevestigd<span>Een bevestiging in jullie mailbox</span></dd></div></dl><div className={styles.help}><strong>Geen passend moment?</strong><p>Staat jullie gewenste dag of tijd er niet bij? Mail de bakkerij; we kijken samen naar een ander moment.</p><a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl ↗</a></div></aside>
        <section className={styles.booking} aria-label="Een bruidstaartafspraak plannen">
          <ol className={styles.steps} aria-label="Boekingsstappen"><li aria-current={step === "choose" ? "step" : undefined}><span>{step === "choose" ? "1" : "✓"}</span>Datum & tijd</li><li aria-current={step === "details" ? "step" : undefined}><span>{step === "confirmed" ? "✓" : "2"}</span>Jullie gegevens</li><li aria-current={step === "confirmed" ? "step" : undefined}><span>3</span>Bevestigd</li></ol>
          <div className={styles.bookingBody}>{bookingError && <p role="alert" className={styles.bookingError}>{bookingError} <a href="mailto:info@strik-patisserie.nl">Mail de bakkerij</a>{!preview && <button type="button" className={styles.back} onClick={() => { setBookingError(""); setRefresh(value => value + 1); }}>Ververs vrije tijden</button>}</p>}
            {step === "choose" && <>
              <p className={styles.eyebrow}>Datum en tijd</p><h2 tabIndex={-1} ref={heading}>Wanneer komen jullie langs?</h2><p className={styles.description}>Kies een beschikbare dag en daarna het tijdstip.</p>
              <div className={styles.dateLayout}><div className={styles.calendar}><div className={styles.month}><h3>{new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" }).format(displayMonth)}</h3><div><button type="button" aria-label="Vorige maand" disabled={monthOffset === 0} onClick={() => setMonthOffset(value => value - 1)}>‹</button><button type="button" aria-label="Volgende maand" disabled={monthOffset >= 5} onClick={() => setMonthOffset(value => value + 1)}>›</button></div></div><div className={styles.days}>{weekdays.map(day => <span className={styles.weekday} key={day}>{day}</span>)}{Array.from({ length: leading }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: monthDays }, (_, index) => {
                const date = new Date(Date.UTC(displayMonth.getUTCFullYear(), displayMonth.getUTCMonth(), index + 1, 12));
                const key = dateKey(date);
                  const available = availableTimes(key).length > 0;
                return <button type="button" key={key} aria-label={`${formatDate(key)}${available ? preview ? ", voorbeeldtijd beschikbaar" : ", tijd beschikbaar" : ", niet beschikbaar"}`} aria-pressed={selectedDate === key} disabled={!available} onClick={() => { setSelectedDate(key); setSelectedTime(""); setBookingError(""); }}>{index + 1}{available && <span className={styles.dot} aria-hidden="true" />}</button>;
              })}</div><p className={styles.calendarLegend}><span className={styles.dot} /> {preview ? "Voorbeeld van een beschikbare dag" : loading ? "Vrije tijden laden…" : "Een dag met beschikbare tijden"}</p></div><div className={styles.timePanel} aria-live="polite"><h3>{selectedDate ? new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${selectedDate}T12:00:00Z`)) : "Kies eerst een dag"}</h3><p>{selectedDate ? preview ? "Beschikbare voorbeeldtijden" : "Beschikbare tijden" : "Daarna verschijnen hier de vrije tijden."}</p>{selectedDate && availableTimes(selectedDate).length === 0 && <p>Deze dag heeft geen vrije tijdvakken. Kies een andere dag of mail de bakkerij.</p>}{selectedDate && <div className={styles.times}>{availableTimes(selectedDate).map(time => <button key={time} type="button" aria-pressed={selectedTime === time} onClick={() => { setSelectedTime(time); setBookingError(""); }}>{time}<span>– {endTime(time)}</span>{selectedTime === time && <b aria-hidden="true">✓</b>}</button>)}</div>}</div></div>
              <p className={styles.calendarHelp}>Geen optie op jullie favoriete dag? <a href="mailto:info@strik-patisserie.nl?subject=Bruidstaartafspraak">Mail de bakkerij als jullie gewenste dag of tijd er niet bij staat.</a></p><div className={styles.next}><p>{selectedSummary || "Selecteer een dag en tijdstip"}</p><button type="button" className={styles.primary} disabled={!selectedTime} onClick={() => go("details")}>Jullie gegevens <span>→</span></button></div>
            </>}
            {step === "details" && <>
              <button type="button" className={styles.back} onClick={() => go("choose")}>← Andere datum of tijd kiezen</button><p className={styles.eyebrow}>Contactgegevens</p><h2 tabIndex={-1} ref={heading}>Jullie gegevens</h2><p className={styles.chosen}>{selectedSummary}<span>Strik Ziekerstraat · 30 minuten</span></p>
              <form onSubmit={submitBooking} className={styles.form}>
                <label>Jullie namen <span>*</span><input required name="name" autoComplete="name" placeholder="Bijvoorbeeld Noor & Sam" maxLength={160} value={contact.names} onChange={event => field("names", event.target.value)} /></label>
                <div className={styles.formRow}><label>E-mailadres <span>*</span><input required type="email" name="email" autoComplete="email" placeholder="Voor jullie bevestiging" maxLength={200} value={contact.email} onChange={event => field("email", event.target.value)} /></label><label>Telefoonnummer <span>*</span><input required type="tel" name="tel" autoComplete="tel" maxLength={40} value={contact.phone} onChange={event => field("phone", event.target.value)} /></label></div>
                <div className={styles.formRow}><label>Trouwdatum <small>optioneel</small><input type="date" min={today} value={contact.weddingDate} onChange={event => field("weddingDate", event.target.value)} /></label><label>Aantal gasten <small>ongeveer, optioneel</small><input type="number" inputMode="numeric" min={1} max={2000} placeholder="Bijvoorbeeld 45" value={contact.guests} onChange={event => field("guests", event.target.value)} /></label></div>
                <label>Wat willen jullie alvast met ons delen? <small>optioneel</small><textarea rows={3} maxLength={1500} placeholder="Ideeën, wensen of een vraag voor het gesprek…" value={contact.notes} onChange={event => field("notes", event.target.value)} /></label>
                <p className={styles.smallPrint}>Jullie gegevens gebruiken we om deze afspraak te plannen en contact met jullie op te nemen. Jullie ontvangen een bevestiging per e-mail en één dag vooraf een herinnering.</p><button type="submit" className={styles.primary} disabled={busy}>{busy ? "Afspraak vastleggen…" : preview ? "Bekijk voorbeeldbevestiging" : "Afspraak bevestigen"} <span>→</span></button>
              </form>
            </>}
            {step === "confirmed" && <div className={styles.confirmation}>
              <div className={styles.check} aria-hidden="true">✓</div><p className={styles.eyebrow}>{preview ? "Voorbeeldbevestiging" : "Afspraak bevestigd"}</p><h2 tabIndex={-1} ref={heading}>De afspraak staat<br />gepland, {contact.names}.</h2><p>Jullie bruidstaartafspraak staat gepland.</p><dl><div><dt>Datum & tijd</dt><dd>{formatDate(selectedDate)}<span>{selectedTime}–{endTime(selectedTime)}</span></dd></div><div><dt>Locatie</dt><dd>Strik Ziekerstraat<span>Ziekerstraat 124, Nijmegen</span></dd></div></dl><p className={styles.chosen}>Bevestiging aan {contact.email}<span>Een kopie voor Strik naar info@strik-patisserie.nl</span></p>{preview ? <p className={styles.demoNotice}><strong>Dit is een voorbeeld.</strong> Er is geen afspraak vastgelegd en geen e-mail verstuurd. Dit voorbeeldtijdvak is nu bezet in deze preview.</p> : <p className={styles.demoNotice}>Referentie: <strong>{receipt?.reference}</strong>. De bevestiging wordt naar jullie gemaild. Eén dag vooraf ontvangen jullie een herinnering.</p>}<div className={styles.confirmActions}>{preview && <a className={styles.primary} href="/bruidstaarten/agenda/voorbeeld/bevestiging" target="_blank" rel="noreferrer">Bekijk de bevestigingsmail ↗</a>}<a className={styles.secondary} href={home}>← Terug naar bruidstaarten</a>{preview && <button type="button" className={styles.secondary} onClick={() => { setSelectedTime(""); go("choose"); }}>Nog een voorbeeldafspraak plannen</button>}</div>
            </div>}
          </div>
        </section>
      </div>
      <section className={styles.preparation} aria-labelledby="prepare-heading"><div><p className={styles.eyebrow}>Voor de afspraak</p><h2 id="prepare-heading">Zo bereiden jullie<br />je voor.</h2><p>Jullie hoeven nog niet alles te weten. Neem mee wat jullie al hebben bedacht; samen maken we de plannen concreet.</p><a href={home}>Bekijk de bruidstaartvoorbeelden →</a></div><ol><li><strong>De grote lijnen</strong><p>De trouwdatum, de locatie en een inschatting van het aantal gasten.</p></li><li><strong>Alles wat jullie mooi vinden</strong><p>Een foto, Pinterestbord, kleuren of een favoriete taart. Ook zonder uitgewerkt idee zijn jullie welkom.</p></li><li><strong>Wat jullie lekker vinden</strong><p>Denk alvast na over favoriete smaken, dieetwensen en jullie budget. Vooraf proeven? Bestel een proeftaartje apart, minimaal twee werkdagen van tevoren.</p></li></ol></section>
      <footer className={styles.footer}>Strik Patisserie · Met zorg gemaakt, met plezier gedeeld.</footer>
    </main>
  </div>;
}
