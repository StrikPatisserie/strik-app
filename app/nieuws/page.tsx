import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
import MarkNewsRead from "./MarkNewsRead";
import {
  NEWS_API_URL,
  getLatestNewsPost,
  getNewsPostKey,
  stripImportantTitle,
} from "./newsState";

export const dynamic = "force-dynamic";

type NewsPost = {
  id: string | number;
  title: string;
  content: string;
  date: string;
  image?: string;
};

export default async function NieuwsPage() {
  const res = await fetch(NEWS_API_URL, {
    cache: "no-store",
  });

  const posts = (await res.json()) as NewsPost[];
  const latestPost = getLatestNewsPost(posts);
  const latestKey = latestPost ? getNewsPostKey(latestPost) : "";

  const important = posts
    .filter((p) => p.title.includes("[BELANGRIJK]"))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const normal = posts
    .filter((p) => !p.title.includes("[BELANGRIJK]"))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const Card = ({
    post,
    important = false,
  }: {
    post: NewsPost;
    important?: boolean;
  }) => (
    <article
      className={`w-full max-w-sm overflow-hidden rounded-3xl border shadow-sm ${
        important ? "border-red-200 bg-red-50" : "border-[#ebe7df] bg-white"
      }`}
    >
      {post.image && (
        <img
          src={post.image}
          alt={post.title}
          className="h-44 w-full object-cover"
        />
      )}

      <div className="p-4">
        <p className="text-xs text-gray-500">
          {new Date(post.date).toLocaleDateString("nl-NL")}
        </p>

        <h2 className="mt-1 text-lg font-bold leading-tight">
          {stripImportantTitle(post.title)}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          {post.content}
        </p>
      </div>
    </article>
  );

  return (
    <StrikShell wide>
      {latestKey && <MarkNewsRead latestKey={latestKey} />}

      <StrikPageHeader
        title="Nieuws"
        description="Belangrijke informatie voor intern gebruik."
        icon={strikIcons.news}
        tone="green"
      />

        {important.length > 0 && (
          <section className="mb-8">
            <p className="mb-3 text-sm font-semibold text-red-500">
              🔴 Belangrijk
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {important.map((post) => (
                <Card key={post.id} post={post} important />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {normal.map((post) => (
              <Card key={post.id} post={post} />
            ))}
          </div>
        </section>
    </StrikShell>
  );
}
