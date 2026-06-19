import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
import NieuwsList from "./NieuwsList";
import {
  NEWS_API_URL,
  NewsPost,
  getLatestNewsPost,
  getNewsPostKey,
} from "./newsState";

export const dynamic = "force-dynamic";

export default async function NieuwsPage() {
  const res = await fetch(NEWS_API_URL, {
    cache: "no-store",
  });

  const posts = (await res.json()) as NewsPost[];
  const latestPost = getLatestNewsPost(posts);
  const latestKey = latestPost ? getNewsPostKey(latestPost) : "";
  const latestDate = latestPost?.date || "";

  const important = posts
    .filter((p) => p.title.includes("[BELANGRIJK]"))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const normal = posts
    .filter((p) => !p.title.includes("[BELANGRIJK]"))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <StrikShell wide>
      <StrikPageHeader title="Nieuws" kicker="Winkel" icon={strikIcons.news} />

      <NieuwsList
        important={important}
        normal={normal}
        latestKey={latestKey}
        latestDate={latestDate}
      />
    </StrikShell>
  );
}
