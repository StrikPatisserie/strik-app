import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

export const dynamic = "force-dynamic";

type FileItem = {
  id: string | number;
  url: string;
  date: string;
  title: string;
};

type WordPressRenderedField = {
  rendered?: string;
};

type WordPressMediaItem = {
  id: string | number;
  source_url?: string;
  date?: string;
  slug?: string;
  mime_type?: string;
  title?: WordPressRenderedField;
  caption?: WordPressRenderedField;
  description?: WordPressRenderedField;
};

const WORDPRESS_MEDIA_URL =
  "https://strik-patisserie.nl/wp-json/wp/v2/media?per_page=100&media_type=application&_fields=id,date,title,description,caption,mime_type,source_url,slug";

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#215;/g, "x");
}

function cleanWordPressText(value = "") {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function hasIjsLabel(value: string) {
  return /(^|[^a-z0-9])ijs($|[^a-z0-9])/i.test(value);
}

function isIjsPdf(item: WordPressMediaItem) {
  const sourceUrl = item.source_url ?? "";
  const isPdf =
    item.mime_type === "application/pdf" ||
    sourceUrl.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return false;
  }

  const searchableText = [
    item.title?.rendered,
    item.caption?.rendered,
    item.description?.rendered,
    item.slug,
    sourceUrl,
  ]
    .map((value) => cleanWordPressText(value ?? "").toLowerCase())
    .join(" ");

  return hasIjsLabel(searchableText);
}

function toFileItem(item: WordPressMediaItem): FileItem | null {
  if (!item.source_url || !isIjsPdf(item)) {
    return null;
  }

  return {
    id: item.id,
    url: item.source_url,
    date: item.date ?? "",
    title: cleanWordPressText(item.title?.rendered ?? "IJs document"),
  };
}

async function fetchIjsFiles() {
  const res = await fetch(WORDPRESS_MEDIA_URL, {
    cache: "no-store",
  });

  if (!res.ok) {
    return [] as FileItem[];
  }

  const mediaItems = (await res.json()) as WordPressMediaItem[];

  return mediaItems
    .map(toFileItem)
    .filter((file): file is FileItem => file !== null)
    .sort(
      (fileA, fileB) =>
        new Date(fileB.date).getTime() - new Date(fileA.date).getTime()
    );
}

export default async function IJsInfoPage() {
  const files = await fetchIjsFiles();

  return (
    <StrikShell>
      <StrikPageHeader
        title="IJs documenten"
        description="Specifieke informatie voor de ijssalons, zoals allergenenlijst 2026."
        icon={strikIcons.info}
        tone="light"
      />

      <div className="space-y-3">
        {files.length === 0 ? (
          <div className="rounded-[1.5rem] bg-white p-5 text-sm text-gray-600 shadow-sm">
            Geen ijsdocumenten gevonden. Zet in WordPress bij het bestand in de
            titel, het bijschrift of de beschrijving &quot;ijs&quot;.
          </div>
        ) : (
          files.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[1.5rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm transition active:scale-[0.98] hover:shadow-md"
            >
              <p className="text-xs text-gray-500">
                {new Date(file.date).toLocaleDateString("nl-NL")}
              </p>

              <h2 className="mt-1 text-lg font-bold">{file.title}</h2>

              <div className="mt-3 inline-block rounded-full bg-[#c3d3bc] px-3 py-1 text-xs font-semibold">
                PDF openen
              </div>
            </a>
          ))
        )}
      </div>
    </StrikShell>
  );
}
