import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { hasFullAccess } from "@/app/lib/auth/access";
import { hasRecentMfa } from "@/app/lib/auth/mfa";
import MfaPanel from "./MfaPanel";

export const dynamic = "force-dynamic";
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const candidate = typeof params.next === "string" ? params.next : "";
  const next = candidate.startsWith("/") && !candidate.startsWith("//") && !/[\\\x00-\x1f]/.test(candidate) && !candidate.startsWith("/auth/") ? candidate : "/management/dashboard";
  const db = await createClient();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  const { data: profile } = await db.from("profiles").select("*").eq("id", data.claims.sub).maybeSingle();
  if (!profile?.active) redirect("/login?status=inactive");
  if (!hasFullAccess(profile)) redirect("/");
  if (hasRecentMfa(data.claims)) redirect(next);
  return <main className="min-h-dvh bg-[#c3d3bc] px-4 py-12 text-[#183d29]"><div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm"><MfaPanel next={next} /></div></main>;
}
