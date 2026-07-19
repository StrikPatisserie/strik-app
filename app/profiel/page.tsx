import Link from "next/link";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
import { requireCurrentProfile } from "../lib/auth/session";
import { USER_ROLES, USER_STORES } from "../lib/supabase/types";

export const dynamic = "force-dynamic";

function labelForRole(role: string) {
  return USER_ROLES.find((option) => option.id === role)?.label || role || "Medewerker";
}

function labelForStore(store: string | null) {
  if (!store) return "Algemeen";
  return USER_STORES.find((option) => option.id === store)?.label || store;
}

function ProfileField({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-md border border-[#ebe5dc] bg-[#faf8f5] px-3 py-2">
      <p className="text-[0.68rem] font-black uppercase text-[#7b7268]">
        {label}
      </p>
      <p className="mt-0.5 break-words text-sm font-black text-[#1a1815]">
        {value}
      </p>
    </div>
  );
}

export default async function ProfilePage() {
  const profile = await requireCurrentProfile();
  const initials = (profile.full_name || profile.email || "S")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const activePermissions = Object.keys(profile.permissions || {}).filter(
    (permission) => profile.permissions[permission]
  );

  return (
    <StrikShell>
      <StrikPageHeader
        title="Mijn profiel"
        description="Je account en toegang in de Strik Team App."
        icon={strikIcons.management}
        tone="light"
      />

      <section className="border border-[#e4ded5] bg-white/92 p-4 shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#eee8df] pb-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#1f4f35] text-lg font-black text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-[#1a1815]">
              {profile.full_name || "Geen naam ingesteld"}
            </h2>
            <p className="truncate text-sm font-bold text-[#7b7268]">
              {profile.email}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <ProfileField label="Rol" value={labelForRole(String(profile.role))} />
          <ProfileField label="Winkel / afdeling" value={labelForStore(profile.store)} />
          <ProfileField
            label="Status"
            value={profile.active ? "Actief" : "Niet actief"}
          />
          <ProfileField
            label="Rechten"
            value={
              activePermissions.length > 0
                ? `${activePermissions.length} extra rechten`
                : "Standaard toegang"
            }
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/reset-password"
            className="rounded-md bg-[#f4f0ea] px-3 py-2 text-sm font-black text-[#1a1815] transition hover:bg-[#ebe5dc]"
          >
            Wachtwoord resetten
          </Link>
          <Link
            href="/"
            className="rounded-md bg-[#1f4f35] px-3 py-2 text-sm font-black text-white transition hover:bg-[#173f2a]"
          >
            Terug naar app
          </Link>
        </div>
      </section>
    </StrikShell>
  );
}
