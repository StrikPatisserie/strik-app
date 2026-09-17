import {
  StrikMenuLink,
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../../StrikUI";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";

export const dynamic = "force-dynamic";

const items = [
  {
    href: "/sinterklaas/letters/winkel",
    title: "Winkel",
    icon: strikIcons.sinterklaasLetter,
    tone: "green" as const,
  },
  {
    href: "/sinterklaas/letters/productie",
    title: "Productie",
    icon: strikIcons.sinterklaasProductie,
    tone: "yellow" as const,
  },
  {
    href: "/lettershop",
    title: "Open de chocoladelettershop ↗",
    icon: strikIcons.sinterklaasLetter,
    tone: "green" as const,
    target: "_blank" as const,
    rel: "noopener noreferrer",
  },
];

export default async function SinterklaasLettersPage() {
  const profile = await getCurrentProfile();
  return (
    <StrikShell>
      <StrikPageHeader
        title="Chocoladeletters"
        icon={strikIcons.sinterklaasLetter}
      />

      <div className="grid gap-2">
        {hasFullAccess(profile) && <StrikMenuLink href="/sinterklaas/letters/management" title="Management · nieuwe opzet" icon={strikIcons.management} tone="green" />}
        {hasFullAccess(profile) && <StrikMenuLink href="/sinterklaas/letters/online" title="Online bestellingen · centrale database" icon={strikIcons.sinterklaasLetter} tone="green" />}
        {hasFullAccess(profile) && <StrikMenuLink href="/sinterklaas/letters/centrale-productie" title="Centrale productie · nieuwe bestellingen" icon={strikIcons.sinterklaasProductie} tone="yellow" />}
        {items.map((item) => (
          <StrikMenuLink key={item.href} {...item} />
        ))}
      </div>
    </StrikShell>
  );
}
