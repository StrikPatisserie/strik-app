export type FileItem = {
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

function cleanFileTitle(value = "") {
  return cleanWordPressText(value).replace(/^\[APP-INFO\]\s*/i, "");
}

function hasLabel(value: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escapedLabel}($|[^a-z0-9])`, "i").test(
    value
  );
}

function isPdf(item: WordPressMediaItem) {
  const sourceUrl = item.source_url ?? "";

  return (
    item.mime_type === "application/pdf" ||
    sourceUrl.toLowerCase().endsWith(".pdf")
  );
}

function hasMediaLabel(item: WordPressMediaItem, label: string) {
  const searchableText = [
    item.title?.rendered,
    item.caption?.rendered,
    item.description?.rendered,
    item.slug,
    item.source_url,
  ]
    .map((value) => cleanWordPressText(value ?? "").toLowerCase())
    .join(" ");

  return hasLabel(searchableText, label.toLowerCase());
}

function toFileItem(item: WordPressMediaItem, label: string): FileItem | null {
  if (!item.source_url || !isPdf(item) || !hasMediaLabel(item, label)) {
    return null;
  }

  return {
    id: item.id,
    url: item.source_url,
    date: item.date ?? "",
    title: cleanFileTitle(item.title?.rendered ?? "Document") || "Document",
  };
}

export async function fetchWordPressPdfFilesByLabel(label: string) {
  const res = await fetch(WORDPRESS_MEDIA_URL, {
    cache: "no-store",
  });

  if (!res.ok) {
    return [] as FileItem[];
  }

  const mediaItems = (await res.json()) as WordPressMediaItem[];

  return mediaItems
    .map((item) => toFileItem(item, label))
    .filter((file): file is FileItem => file !== null)
    .sort(
      (fileA, fileB) =>
        new Date(fileB.date).getTime() - new Date(fileA.date).getTime()
    );
}
