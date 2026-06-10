import { StrikShell } from "../StrikUI";
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
      <header className="mb-4 border-b border-[#e7e0d8] pb-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ef5737]">
          Winkel
        </p>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.12em] text-[#1a1815] sm:text-3xl">
          Nieuws
        </h1>
      </header>

      <NieuwsList
        important={important}
        normal={normal}
        latestKey={latestKey}
        latestDate={latestDate}
      />
    </StrikShell>
  );
}
