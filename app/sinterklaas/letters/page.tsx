import DepartmentHub from "../../DepartmentHub";
import SecondaryResourceLink from "../../SecondaryResourceLink";
import { strikIcons } from "../../StrikUI";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function SinterklaasLettersPage() {
  const profile = await getCurrentProfile();
  const items = [
    { href: "/sinterklaas/letters/winkel", title: "Winkel", description: "", icon: strikIcons.sinterklaasLetter, accent: "green" as const },
    ...(hasFullAccess(profile) ? [{ href: "/sinterklaas/letters/online", title: "Webshop", description: "", icon: strikIcons.sinterklaasLetter, accent: "blue" as const }] : []),
    { href: "/sinterklaas/letters/productie", title: "Productie", description: "", icon: strikIcons.sinterklaasProductie, accent: "yellow" as const },
  ];

  return (
    <DepartmentHub title="Chocoladeletters" description="" icon={strikIcons.sinterklaasLetter} items={items}>
      <div className="flex justify-end">
        <SecondaryResourceLink href="/lettershop" title="Bekijk de chocoladelettershop" label="Openbare pagina" icon={strikIcons.info} newTab />
      </div>
    </DepartmentHub>
  );
}
