"use client";

import { useEffect, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

const NEWS_API_URL = "https://strik-patisserie.nl/wp-json/strik/v1/news";
const NEWS_API_KEY = "schoonmaak-ijs-strik";

type NewsPost = {
  id: number;
  title: string;
  content: string;
  date: string;
  image?: string | false;
};

function getNewsUrl(id?: number) {
  const url = new URL(id ? `${NEWS_API_URL}/${id}` : NEWS_API_URL);
  url.searchParams.set("key", NEWS_API_KEY);

  return url;
}

function stripImportant(title: string) {
  return title.replace("[BELANGRIJK]", "").trim();
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
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [titel, setTitel] = useState("");
  const [bericht, setBericht] = useState("");
  const [belangrijk, setBelangrijk] = useState(false);
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
    setImageData("");
    setImageName("");
  }

  function editPost(post: NewsPost) {
    setEditingId(post.id);
    setTitel(stripImportant(post.title));
    setBericht(post.content);
    setBelangrijk(post.title.includes("[BELANGRIJK]"));
    setImageData("");
    setImageName("");
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          title: belangrijk ? `[BELANGRIJK] ${titel.trim()}` : titel.trim(),
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
    if (!confirm(`Nieuwsbericht verwijderen: ${stripImportant(post.title)}?`)) return;

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
                onClick={resetForm}
                className="rounded-full bg-[#f8f6f3] px-4 py-2 text-sm font-bold"
              >
                Nieuw
              </button>
            )}
          </div>

          <div className="space-y-4">
            <input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Titel"
              className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
            />

            <textarea
              value={bericht}
              onChange={(e) => setBericht(e.target.value)}
              placeholder="Bericht"
              className="min-h-40 w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
            />

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
              onClick={savePost}
              disabled={bezig}
              className="w-full rounded-full bg-[#c3d3bc] p-4 font-bold text-[#2d2a26] shadow-sm active:scale-[0.98] disabled:opacity-60"
            >
              {bezig ? "Opslaan..." : editingId ? "Wijzigingen opslaan" : "Nieuws plaatsen"}
            </button>

            {status && (
              <p className="rounded-2xl bg-[#f8f6f3] p-3 text-center text-sm shadow-sm">
                {status}
              </p>
            )}
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
                className="overflow-hidden rounded-[1.5rem] border border-[#e7e0d8] bg-white shadow-sm"
              >
                {post.image && (
                  <img
                    src={post.image}
                    alt={stripImportant(post.title)}
                    className="h-44 w-full object-cover"
                  />
                )}

                <div className="p-5">
                  <p className="text-xs text-gray-500">
                    {new Date(post.date).toLocaleDateString("nl-NL")}
                  </p>
                  <h3 className="mt-1 text-lg font-bold">
                    {stripImportant(post.title)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-700">
                    {post.content}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => editPost(post)}
                      className="rounded-full bg-[#c3d3bc] px-4 py-3 text-sm font-bold"
                    >
                      Aanpassen
                    </button>
                    <button
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
