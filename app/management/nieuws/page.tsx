"use client";

import { useEffect, useRef, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import { NewsRichContent } from "../../nieuws/NewsRichContent";
import {
  IMPORTANT_NEWS_MARKER,
  NEWSLETTER_MARKER,
  NEWS_API_URL,
  NewsPost,
  getNewsPlainText,
  isImportantNewsPost,
  isNewsletterPost,
  stripNewsTitleMarkers,
} from "../../nieuws/newsState";

const NEWS_API_KEY =
  process.env.NEXT_PUBLIC_WORDPRESS_STRIK_API_KEY || "schoonmaak-ijs-strik";

function getNewsUrl(id?: string | number) {
  const url = new URL(id ? `${NEWS_API_URL}/${id}` : NEWS_API_URL);
  url.searchParams.set("key", NEWS_API_KEY);

  return url;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function NieuwsBeheerPage() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [titel, setTitel] = useState("");
  const [bericht, setBericht] = useState("");
  const [belangrijk, setBelangrijk] = useState(false);
  const [nieuwsbrief, setNieuwsbrief] = useState(false);
  const [imageData, setImageData] = useState("");
  const [imageName, setImageName] = useState("");
  const [status, setStatus] = useState("");
  const [bezig, setBezig] = useState(false);
  const [ladenBezig, setLadenBezig] = useState(true);

  async function laadNieuws() {
    setLadenBezig(true);

    try {
      const res = await fetch(getNewsUrl(), { cache: "no-store" });
      const data = (await res.json()) as NewsPost[];

      setPosts(data);
    } catch {
      setStatus("Nieuwsberichten konden niet geladen worden.");
    } finally {
      setLadenBezig(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      laadNieuws();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitel("");
    setBericht("");
    setBelangrijk(false);
    setNieuwsbrief(false);
    setImageData("");
    setImageName("");
  }

  function editPost(post: NewsPost) {
    setEditingId(post.id);
    setTitel(stripNewsTitleMarkers(post.title));
    setBericht(post.content);
    setBelangrijk(isImportantNewsPost(post));
    setNieuwsbrief(isNewsletterPost(post));
    setImageData("");
    setImageName("");
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusTextarea(selectionStart?: number, selectionEnd?: number) {
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();

      if (
        typeof selectionStart === "number" &&
        typeof selectionEnd === "number"
      ) {
        textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  }

  function insertTemplate(template: string, selectedText?: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? bericht.length;
    const end = textarea?.selectionEnd ?? bericht.length;
    const prefix = start > 0 && !bericht.slice(0, start).endsWith("\n") ? "\n" : "";
    const next = `${bericht.slice(0, start)}${prefix}${template}${bericht.slice(end)}`;
    const selectionOffset = selectedText ? template.indexOf(selectedText) : -1;

    setBericht(next);

    if (selectedText && selectionOffset >= 0) {
      const selectionStart = start + prefix.length + selectionOffset;
      focusTextarea(selectionStart, selectionStart + selectedText.length);
      return;
    }

    focusTextarea(start + prefix.length + template.length, start + prefix.length + template.length);
  }

  function wrapSelection(before: string, after: string, placeholder: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? bericht.length;
    const end = textarea?.selectionEnd ?? bericht.length;
    const selected = bericht.slice(start, end) || placeholder;
    const insert = `${before}${selected}${after}`;
    const next = `${bericht.slice(0, start)}${insert}${bericht.slice(end)}`;

    setBericht(next);

    const selectionStart = start + before.length;
    focusTextarea(selectionStart, selectionStart + selected.length);
  }

  function useNewsletterTemplate() {
    if (
      bericht.trim() &&
      !confirm("Huidige tekst vervangen door nieuwsbrief-opzet?")
    ) {
      return;
    }

    setNieuwsbrief(true);
    setBericht(
      "## Hoofdonderwerp\n\n*Korte samenvatting*\n\nSchrijf hier de eerste alinea.\n\n## Praktisch\n\n- Punt een\n- Punt twee\n"
    );
    focusTextarea(3, 17);
  }

  function buildPostTitle() {
    const markers = [
      belangrijk ? IMPORTANT_NEWS_MARKER : "",
      nieuwsbrief ? NEWSLETTER_MARKER : "",
    ].filter(Boolean);

    return [...markers, titel.trim()].join(" ");
  }

  async function handleImage(file?: File) {
    if (!file) {
      setImageData("");
      setImageName("");
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setImageData(dataUrl);
    setImageName(file.name);
  }

  async function savePost() {
    if (!titel.trim()) {
      setStatus("Vul eerst een titel in.");
      return;
    }

    if (!bericht.trim()) {
      setStatus("Vul eerst een bericht in.");
      return;
    }

    setBezig(true);
    setStatus(editingId ? "Aanpassen..." : "Plaatsen...");

    try {
      const res = await fetch(getNewsUrl(editingId || undefined), {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: buildPostTitle(),
          content: bericht.trim(),
          image: imageData || undefined,
          imageName: imageName || undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (res.ok) {
        setStatus(editingId ? "Nieuwsbericht aangepast." : "Nieuwsbericht geplaatst.");
        resetForm();
        await laadNieuws();
        return;
      }

      if (res.status === 404 || res.status === 405) {
        setStatus("WordPress ondersteunt deze nieuwsactie nog niet.");
        return;
      }

      setStatus(data?.message || "Opslaan mislukt.");
    } catch {
      setStatus("Kan geen verbinding maken met WordPress.");
    } finally {
      setBezig(false);
    }
  }

  async function deletePost(post: NewsPost) {
    if (!confirm(`Nieuwsbericht verwijderen: ${stripNewsTitleMarkers(post.title)}?`)) return;

    setBezig(true);
    setStatus("Verwijderen...");

    try {
      const res = await fetch(getNewsUrl(post.id), { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (res.ok) {
        setStatus("Nieuwsbericht verwijderd.");
        if (editingId === post.id) resetForm();
        await laadNieuws();
        return;
      }

      setStatus(data?.message || "Verwijderen mislukt.");
    } catch {
      setStatus("Kan geen verbinding maken met WordPress.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <StrikShell wide>
        <StrikPageHeader
          title="Nieuws beheren"
          description="Plaats, pas aan of verwijder interne nieuwsberichten."
          icon={strikIcons.newsManagement}
          kicker="Management"
          tone="green"
        />

        <section className="mb-6 rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              {editingId ? "Nieuwsbericht aanpassen" : "Nieuwsbericht toevoegen"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full bg-[#f8f6f3] px-4 py-2 text-sm font-bold"
              >
                Nieuw
              </button>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 rounded-full bg-[#f8f6f3] p-1">
                {[
                  { label: "Normaal", value: false },
                  { label: "Nieuwsbrief", value: true },
                ].map((mode) => (
                  <button
                    key={mode.label}
                    type="button"
                    onClick={() => setNieuwsbrief(mode.value)}
                    className={`rounded-full px-3 py-2 text-sm font-black transition ${
                      nieuwsbrief === mode.value
                        ? "bg-white text-[#1a1815] shadow-sm"
                        : "text-[#2d2a26]/55"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <input
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder="Titel"
                className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
              />

              <div className="rounded-2xl border border-[#e7e0d8] bg-white">
                <div className="flex flex-wrap gap-2 border-b border-[#e7e0d8] bg-[#f8f6f3] p-2">
                  <button
                    type="button"
                    onClick={() => insertTemplate("## Kopje\n\n", "Kopje")}
                    className="rounded-full bg-white px-3 py-2 text-xs font-black shadow-sm"
                  >
                    Kopje
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTemplate("*Subtitel*\n\n", "Subtitel")}
                    className="rounded-full bg-white px-3 py-2 text-xs font-black shadow-sm"
                  >
                    Subtitel
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelection("**", "**", "vetgedrukte tekst")}
                    className="rounded-full bg-white px-3 py-2 text-xs font-black shadow-sm"
                  >
                    Vet
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTemplate("- Punt een\n- Punt twee\n", "Punt een")}
                    className="rounded-full bg-white px-3 py-2 text-xs font-black shadow-sm"
                  >
                    Lijst
                  </button>
                  <button
                    type="button"
                    onClick={useNewsletterTemplate}
                    className="rounded-full bg-[#f1d28f]/75 px-3 py-2 text-xs font-black shadow-sm"
                  >
                    Opzet
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={bericht}
                  onChange={(e) => setBericht(e.target.value)}
                  placeholder={
                    nieuwsbrief
                      ? "Schrijf je nieuwsbrief..."
                      : "Schrijf je nieuwsbericht..."
                  }
                  className="min-h-56 w-full resize-y rounded-b-2xl bg-white p-4 outline-none"
                />
              </div>

              <label className="block rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-4">
                <span className="mb-2 block font-semibold">Afbeelding</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImage(e.target.files?.[0])}
                  className="w-full text-sm"
                />
                {imageName && (
                  <span className="mt-2 block text-xs font-semibold text-gray-500">
                    Gekozen: {imageName}
                  </span>
                )}
              </label>

              <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#e7e0d8] bg-white p-4">
                <span className="font-semibold">Belangrijk bericht</span>
                <input
                  type="checkbox"
                  checked={belangrijk}
                  onChange={(e) => setBelangrijk(e.target.checked)}
                  className="h-5 w-5"
                />
              </label>

              <button
                type="button"
                onClick={savePost}
                disabled={bezig}
                className="w-full rounded-full bg-[#c3d3bc] p-4 font-bold text-[#2d2a26] shadow-sm active:scale-[0.98] disabled:opacity-60"
              >
                {bezig
                  ? "Opslaan..."
                  : editingId
                  ? "Wijzigingen opslaan"
                  : "Nieuws plaatsen"}
              </button>

              {status && (
                <p className="rounded-2xl bg-[#f8f6f3] p-3 text-center text-sm shadow-sm">
                  {status}
                </p>
              )}
            </div>

            <aside className="rounded-[1.25rem] border border-[#e7e0d8] bg-[#fffdf8] p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b8278]">
                  Preview
                </p>
                {nieuwsbrief && (
                  <span className="rounded-full bg-[#f8f1e6] px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.12em] text-[#ef5737]">
                    Nieuwsbrief
                  </span>
                )}
              </div>

              <article
                className={`rounded-[1rem] border p-4 ${
                  nieuwsbrief
                    ? "border-[#dfd4c4] bg-white"
                    : "border-[#e8e4de] bg-white"
                }`}
              >
                <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
                  Vandaag
                </p>
                <h3
                  className={
                    nieuwsbrief
                      ? "mt-1.5 text-2xl font-black leading-tight text-[#1a1815]"
                      : "mt-1.5 text-lg font-black leading-tight text-[#1a1815]"
                  }
                >
                  {titel.trim() || "Titel"}
                </h3>
                {bericht.trim() ? (
                  <NewsRichContent
                    content={bericht}
                    tone={nieuwsbrief ? "newsletter" : "normal"}
                    className="mt-4"
                  />
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-[#6b645b]">
                    Je tekst verschijnt hier.
                  </p>
                )}
              </article>
            </aside>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Bestaande nieuwsberichten</h2>
            {ladenBezig && (
              <span className="text-sm font-semibold text-gray-500">Laden...</span>
            )}
          </div>

          <div className="space-y-4">
            {posts.map((post) => (
              <article
                key={post.id}
                className={`overflow-hidden rounded-[1.5rem] border bg-white shadow-sm ${
                  isNewsletterPost(post) ? "border-[#dfd4c4]" : "border-[#e7e0d8]"
                }`}
              >
                {post.image && (
                  <img
                    src={post.image}
                    alt={stripNewsTitleMarkers(post.title)}
                    className="h-44 w-full object-cover"
                  />
                )}

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-gray-500">
                      {new Date(post.date).toLocaleDateString("nl-NL")}
                    </p>
                    {isNewsletterPost(post) && (
                      <span className="rounded-full bg-[#f8f1e6] px-2.5 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#ef5737]">
                        Nieuwsbrief
                      </span>
                    )}
                    {isImportantNewsPost(post) && (
                      <span className="rounded-full bg-[#fff0ed] px-2.5 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#d75a48]">
                        Belangrijk
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-lg font-bold">
                    {stripNewsTitleMarkers(post.title)}
                  </h3>
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-gray-700">
                    {getNewsPlainText(post.content || "")}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => editPost(post)}
                      className="rounded-full bg-[#c3d3bc] px-4 py-3 text-sm font-bold"
                    >
                      Aanpassen
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePost(post)}
                      className="rounded-full bg-[#d75a48] px-4 py-3 text-sm font-bold text-white"
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
    </StrikShell>
  );
}
