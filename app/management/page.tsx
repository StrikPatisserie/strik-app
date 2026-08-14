/* eslint-disable @next/next/no-img-element */
import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "../StrikUI";
import Link from "next/link";
import ManagementStatusSection from "./ManagementStatusSection";

type ManagementMenuItem = {
  href: string;
  label: string;
  title: string;
  description: string;
  icon: string;
};

const managementGroups: {
  title: string;
  items: ManagementMenuItem[];
}[] = [
  {
    title: "Overzicht",
    items: [
      {
        href: "/management/dashboard",
        label: "Analyse",
        title: "Dashboard",
        description: "Omzet, uren, productiviteit en loonkosten.",
        icon: strikIcons.management,
      },
      {
        href: "/management/cijfers-evaluaties",
        label: "Evaluaties",
        title: "Cijfers & evaluaties",
        description: "Feestdagen, omzetnotities, assortiment en drukwerk.",
        icon: strikIcons.data,
      },
      {
        href: "/management/gegevens",
        label: "Brondata",
        title: "Gegevens",
        description: "Agenda, aanbiedingen, nieuws en omzet.",
        icon: strikIcons.info,
      },
      {
        href: "/management/gegevens/geld-tellen",
        label: "Cash",
        title: "Geld tellen",
        description: "Kluiscontrole, weektotalen en stortingen.",
        icon: strikIcons.management,
      },
      {
        href: "/management/rooster",
        label: "Tamigo",
        title: "Rooster",
        description: "Werkrooster en loonkosten.",
        icon: strikIcons.strikAgenda,
      },
    ],
  },
  {
    title: "Beheer",
    items: [
      {
        href: "/settings",
        label: "Beheer",
        title: "Gebruikers & app",
        description: "Accounts, rechten en app-instellingen beheren.",
        icon: strikIcons.management,
      },
      {
        href: "/schoonmaak/overzicht",
        label: "IJssalons",
        title: "Schoonmaak",
        description: "Registraties per datum en locatie.",
        icon: strikIcons.cleaningManagement,
      },
    ],
  },
];

function ManagementMenuLink({ item }: Readonly<{ item: ManagementMenuItem }>) {
  return (
    <Link
      href={item.href}
      className="group grid min-h-[4.5rem] grid-cols-[2.5rem_1fr_1.75rem] items-center gap-3 rounded-lg border border-[#e5ded5] bg-white/92 px-3 py-2 shadow-sm transition hover:border-[#cbdcc5] hover:bg-white active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#ecf4ed]">
        <img src={item.icon} alt="" className="h-6 w-6 object-contain" />
      </span>

      <span className="min-w-0">
        <span className="block text-[0.62rem] font-black uppercase leading-tight tracking-normal text-[#8b8278]">
          {item.label}
        </span>
        <span className="mt-0.5 block truncate text-sm font-black leading-tight text-[#1a1815] sm:text-base">
          {item.title}
        </span>
        <span className="mt-0.5 block text-xs font-bold leading-snug text-[#6b645b]">
          {item.description}
        </span>
      </span>

      <span
        className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f4f0ea] text-base font-black text-[#8b8278] transition group-hover:bg-[#ecf4ed] group-hover:text-[#1f4f35]"
        aria-hidden="true"
      >
        &gt;
      </span>
    </Link>
  );
}

export default function ManagementPage() {
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Management"
        description="Overzichten, brondata en beheer."
        icon={strikIcons.management}
        tone="light"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {managementGroups.map((group) => (
          <section key={group.title} className="space-y-2">
            <h2 className="text-[0.72rem] font-black uppercase leading-tight tracking-normal text-[#7b7268]">
              {group.title}
            </h2>
            <div className="grid gap-2">
              {group.items.map((item) => (
                <ManagementMenuLink key={item.href} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <ManagementStatusSection />
    </StrikShell>
  );
}
