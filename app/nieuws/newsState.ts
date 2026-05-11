export const NEWS_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/news";
export const NEWS_READ_KEY = "strik-news-read-key";
export const NEWS_READ_EVENT = "strik-news-read-change";

export type NewsPostPreview = {
  id: string | number;
  title: string;
  date: string;
};

export function stripImportantTitle(title: string) {
  return title.replace("[BELANGRIJK]", "").trim();
}

export function getNewsPostKey(post: NewsPostPreview) {
  return `${post.id}-${post.date}`;
}

export function getLatestNewsPost<T extends NewsPostPreview>(posts: T[]) {
  return [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
}
