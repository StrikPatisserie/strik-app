export const NEWS_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/news";
export const NEWS_READ_KEY = "strik-news-read-key";
export const NEWS_READ_DATE_KEY = "strik-news-read-date";
export const NEWS_READ_EVENT = "strik-news-read-change";
export const IMPORTANT_NEWS_MARKER = "[BELANGRIJK]";
export const NEWSLETTER_MARKER = "[NIEUWSBRIEF]";

export type NewsPostPreview = {
  id: string | number;
  title: string;
  date: string;
};

export type NewsPost = NewsPostPreview & {
  content: string;
  image?: string | false;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMarker(title: string, marker: string) {
  return title
    .replace(new RegExp(`\\s*${escapeRegExp(marker)}\\s*`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripImportantTitle(title: string) {
  return stripMarker(title, IMPORTANT_NEWS_MARKER);
}

export function stripNewsTitleMarkers(title: string) {
  return stripMarker(stripImportantTitle(title), NEWSLETTER_MARKER);
}

export function isImportantNewsPost(post: NewsPostPreview) {
  return post.title.toLowerCase().includes(IMPORTANT_NEWS_MARKER.toLowerCase());
}

export function isNewsletterPost(post: NewsPostPreview) {
  const title = post.title.toLowerCase();
  const displayTitle = stripNewsTitleMarkers(post.title).toLowerCase();

  return (
    title.includes(NEWSLETTER_MARKER.toLowerCase()) ||
    displayTitle.includes("nieuwsbrief")
  );
}

export function getNewsPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function getNewsPostKey(post: NewsPostPreview) {
  return `${post.id}-${post.date}`;
}

export function getLatestNewsPost<T extends NewsPostPreview>(posts: T[]) {
  return [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
}
