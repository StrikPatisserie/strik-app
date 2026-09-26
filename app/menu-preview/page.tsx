import type { Metadata } from "next";
import Link from "next/link";
import BruidstaartStudioConfigurator from "../bruidstaart-studio/BruidstaartStudioConfigurator";
import CompactStaffOverview from "../CompactStaffOverview";
import DepartmentHub, { type DepartmentHubItem } from "../DepartmentHub";
import SecondaryResourceLink from "../SecondaryResourceLink";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
import BruidstaartenOverzichtPreview from "./BruidstaartenOverzichtPreview";
import BruidstaartProductiePreview from "./BruidstaartProductiePreview";
import BakeryRegistrationPreview from "./BakeryRegistrationPreview";
import NieuwReceptPreview from "./NieuwReceptPreview";
import ReceptenPreview from "./ReceptenPreview";
import SchoonmaakroosterPatisseriePreview from "./SchoonmaakroosterPatisseriePreview";
import SchoonmaakroosterStoreChooser from "../winkel/haccp/SchoonmaakroosterStoreChooser";
import WinkelTemperatureStoreChooser from "../winkel/schoonmaak-registratie/WinkelTemperatureStoreChooser";
import WinkelPlanPreview from "./WinkelPlanPreview";

export const metadata: Metadata = {
  title: "Menu-preview · Strik Team App",
};

type PreviewKey =
  | "winkel"
  | "haccp"
  | "winkel-temperatuurregistratie"
  | "afsluitplan-winkels"
  | "opstartplan-winkels"
  | "schoonmaakrooster-winkels"
  | "schoonmaakrooster-patisserie"
  | "ijs"
  | "logistiek"
  | "productie"
  | "bakkerij"
  | "bakkerij-haccp"
  | "bakkerij-temperatuurregistratie"
  | "bakkerij-goederenregistratie"
  | "bakkerij-temperaturen-overzicht"
  | "recepten"
  | "nieuw-recept"
  | "bruidstaart-productie"
  | "bruidstaarten"
  | "bruidstaart-studio"
  | "bruidstaarten-overzicht"
  | "management"
  | "vierdaagse"
  | "sinterklaas";

type MenuPreview = {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  tone?: "green" | "yellow" | "coral";
  items: readonly DepartmentHubItem[];
};

const previews: Record<PreviewKey, MenuPreview> = {
  winkel: {
    label: "Winkel",
    eyebrow: "Strik winkels",
    title: "Winkel",
    description: "Alles voor de werkdag in de winkel, rustig bij elkaar.",
    icon: strikIcons.winkel,
    items: [
      { href: "/menu-preview?menu=haccp", title: "HACCP & werkplannen", description: "", icon: strikIcons.cleaning, accent: "green" },
      { href: "/menu-preview?menu=bruidstaarten", title: "Bruidstaarten", description: "", icon: strikIcons.bruidstaart, accent: "coral" },
      { href: "#", title: "Documenten", description: "", icon: strikIcons.info, accent: "yellow" },
    ],
  },
  haccp: {
    label: "HACCP & werkplannen",
    eyebrow: "Winkel",
    title: "HACCP & werkplannen",
    description: "",
    icon: strikIcons.cleaning,
    items: [
      { href: "/menu-preview?menu=schoonmaakrooster-winkels", title: "Schoonmaakrooster", description: "", icon: strikIcons.cleaning, accent: "green" },
      { href: "/menu-preview?menu=winkel-temperatuurregistratie", title: "Temperatuurregistratie", description: "", icon: strikIcons.cleaning, accent: "yellow" },
      { href: "/menu-preview?menu=afsluitplan-winkels", title: "Afsluitplan patisserie", description: "", icon: strikIcons.afsluitplan, accent: "blue" },
      { href: "/menu-preview?menu=opstartplan-winkels", title: "Opstartplan patisserie", description: "", icon: strikIcons.opstartplan, accent: "coral" },
    ],
  },
  "schoonmaakrooster-patisserie": {
    label: "Schoonmaakrooster",
    eyebrow: "HACCP & werkplannen",
    title: "Schoonmaakrooster patisserie",
    description: "Weektaak en dagtaken met autosave per winkel.",
    icon: strikIcons.cleaning,
    items: [],
  },
  "schoonmaakrooster-winkels": {
    label: "Schoonmaakrooster",
    eyebrow: "HACCP & werkplannen",
    title: "Schoonmaakrooster",
    description: "",
    icon: strikIcons.cleaning,
    items: [],
  },
  "winkel-temperatuurregistratie": { label: "Temperatuurregistratie", eyebrow: "Winkel", title: "Temperatuurregistratie", description: "", icon: strikIcons.cleaning, items: [] },
  "afsluitplan-winkels": { label: "Afsluitplan", eyebrow: "HACCP & werkplannen", title: "Afsluitplan", description: "", icon: strikIcons.afsluitplan, items: [] },
  "opstartplan-winkels": { label: "Opstartplan", eyebrow: "HACCP & werkplannen", title: "Opstartplan", description: "", icon: strikIcons.opstartplan, items: [] },
  ijs: {
    label: "IJssalons",
    eyebrow: "Strik ijssalons",
    title: "IJssalons",
    description: "Bestellen, openen, afsluiten en alle praktische informatie.",
    icon: strikIcons.ijs,
    tone: "coral",
    items: [
      { href: "#", title: "IJs bestellen", description: "", icon: strikIcons.ijs, accent: "green" },
      { href: "#", title: "Opstartplan", description: "", icon: strikIcons.opstartplan, accent: "yellow" },
      { href: "#", title: "Afsluitplan", description: "", icon: strikIcons.afsluitplan, accent: "coral" },
      { href: "#", title: "Informatie", description: "", icon: strikIcons.info, accent: "blue" },
    ],
  },
  logistiek: {
    label: "Logistiek",
    eyebrow: "Strik logistiek",
    title: "Logistiek",
    description: "Dagstart, routes en magazijn zonder extra navigatielaag.",
    icon: strikIcons.logistiek,
    items: [
      { href: "#", title: "Dagstart", description: "", icon: strikIcons.logistiekDagstart, accent: "green" },
      { href: "#", title: "Havelaar", description: "", icon: strikIcons.logistiek, accent: "yellow" },
    ],
  },
  productie: {
    label: "Productie",
    eyebrow: "Strik productie",
    title: "Productie",
    description: "Kies de afdeling waarmee je wilt werken.",
    icon: strikIcons.bakkerij,
    items: [
      { href: "/menu-preview?menu=bakkerij", title: "Bakkerij", description: "", icon: strikIcons.gebak, accent: "green" },
      { href: "/menu-preview?menu=productie", title: "IJs & chocolade", description: "", icon: strikIcons.ijsChocolade, accent: "yellow" },
      { href: "/menu-preview?menu=productie", title: "Data & management", description: "", icon: strikIcons.data, accent: "blue" },
    ],
  },
  bakkerij: {
    label: "Bakkerij",
    eyebrow: "Productie",
    title: "Bakkerij",
    description: "Recepturen, planning en registraties voor de bakkerij.",
    icon: strikIcons.gebak,
    items: [
      { href: "/menu-preview?menu=recepten", title: "Recepten", description: "", icon: strikIcons.recepturen, accent: "green" },
      { href: "/menu-preview?menu=bakkerij", title: "Productieplanning", description: "", icon: strikIcons.bakkerij, accent: "yellow" },
      { href: "/menu-preview?menu=bruidstaart-productie", title: "Bruidstaart productie", description: "", icon: strikIcons.bruidstaart, accent: "coral" },
      { href: "/menu-preview?menu=bakkerij-haccp", title: "HACCP & registraties", description: "", icon: strikIcons.cleaning, accent: "blue" },
    ],
  },
  "bakkerij-haccp": {
    label: "HACCP & registraties",
    eyebrow: "Bakkerij",
    title: "HACCP & registraties",
    description: "",
    icon: strikIcons.cleaning,
    items: [
      {
        href: "/menu-preview?menu=bakkerij-temperatuurregistratie",
        title: "Temperatuurregistratie",
        description: "",
        icon: strikIcons.cleaning,
        accent: "yellow",
      },
      {
        href: "/menu-preview?menu=bakkerij-goederenregistratie",
        title: "Goederenregistratie",
        description: "",
        icon: strikIcons.info,
        accent: "green",
      },
      {
        href: "/menu-preview?menu=bakkerij-temperaturen-overzicht",
        title: "Temperaturen overzicht",
        description: "",
        icon: strikIcons.data,
        accent: "blue",
      },
    ],
  },
  recepten: {
    label: "Recepten",
    eyebrow: "Bakkerij",
    title: "Recepten",
    description: "Veilige voorbeeldweergave van de receptenlijst.",
    icon: strikIcons.recepturen,
    items: [],
  },
  "bakkerij-temperatuurregistratie": {
    label: "Temperatuurregistratie",
    eyebrow: "HACCP & registraties",
    title: "Temperatuurregistratie",
    description: "Voorbeeldweergave van de bakkerijtemperaturen.",
    icon: strikIcons.cleaning,
    items: [],
  },
  "bakkerij-goederenregistratie": {
    label: "Goederenregistratie",
    eyebrow: "HACCP & registraties",
    title: "Goederenregistratie",
    description: "Voorbeeldweergave van inkomende goederen.",
    icon: strikIcons.info,
    items: [],
  },
  "bakkerij-temperaturen-overzicht": {
    label: "Temperaturen overzicht",
    eyebrow: "HACCP & registraties",
    title: "Temperaturen overzicht",
    description: "Voorbeeldweergave van het maandrapport.",
    icon: strikIcons.data,
    items: [],
  },
  "nieuw-recept": {
    label: "Nieuw recept",
    eyebrow: "Recepten",
    title: "Nieuw recept",
    description: "Veilige voorbeeldweergave van het nieuwe receptformulier.",
    icon: strikIcons.recepturen,
    items: [],
  },
  "bruidstaart-productie": {
    label: "Bruidstaart productie",
    eyebrow: "Bakkerij",
    title: "Bruidstaart productie",
    description: "Veilige voorbeeldweergave van de weekplanning.",
    icon: strikIcons.bruidstaart,
    items: [],
  },
  bruidstaarten: {
    label: "Bruidstaarten",
    eyebrow: "Winkel",
    title: "Bruidstaarten",
    description: "Studio, afspraken en inspiratie voor bruidstaartklanten.",
    icon: strikIcons.bruidstaart,
    tone: "coral",
    items: [
      { href: "/menu-preview?menu=bruidstaart-studio", title: "Bruidstaart Studio", description: "", icon: strikIcons.bruidstaart, accent: "coral" },
      { href: "#", title: "Geplande afspraken", description: "", icon: strikIcons.strikAgenda, accent: "green" },
      { href: "/menu-preview?menu=bruidstaarten-overzicht", title: "Bruidstaarten overzicht", description: "", icon: strikIcons.data, accent: "blue" },
    ],
  },
  "bruidstaart-studio": {
    label: "Bruidstaart Studio",
    eyebrow: "Bruidstaarten",
    title: "Bruidstaart Studio",
    description: "Veilige lokale weergave van de bestaande Studio.",
    icon: strikIcons.bruidstaart,
    items: [],
  },
  "bruidstaarten-overzicht": {
    label: "Bruidstaarten overzicht",
    eyebrow: "Bruidstaarten",
    title: "Bruidstaarten overzicht",
    description: "Definitieve bruidstaarten per maand.",
    icon: strikIcons.bruidstaart,
    items: [],
  },
  management: {
    label: "Management",
    eyebrow: "Strik management",
    title: "Management",
    description: "Overzichten, brondata en beheer op één rustige plek.",
    icon: strikIcons.management,
    items: [
      { href: "#", title: "Dashboard", description: "", icon: strikIcons.management, accent: "green" },
      { href: "#", title: "Cijfers & evaluaties", description: "", icon: strikIcons.data, accent: "blue" },
      { href: "#", title: "Gegevens", description: "", icon: strikIcons.info, accent: "yellow" },
      { href: "#", title: "Rooster", description: "", icon: strikIcons.strikAgenda, accent: "coral" },
      { href: "#", title: "Gebruikers & app", description: "", icon: strikIcons.management, accent: "green" },
      { href: "#", title: "Schoonmaak", description: "", icon: strikIcons.cleaningManagement, accent: "blue" },
    ],
  },
  vierdaagse: {
    label: "Vierdaagse",
    eyebrow: "Evenement",
    title: "Vierdaagse",
    description: "Kraam en Ziekerstraat overzichtelijk voorbereid.",
    icon: strikIcons.strikAgenda,
    tone: "coral",
    items: [
      { href: "#", title: "Rekentool kraam", description: "", icon: "/Downloads/UITZOEKEN/market_10989752.png", accent: "coral" },
      { href: "#", title: "Proeverij Ziekerstraat", description: "", icon: "/app%20strik_kassa.svg", accent: "green" },
    ],
  },
  sinterklaas: {
    label: "Sinterklaas",
    eyebrow: "Seizoen",
    title: "Sinterklaas",
    description: "Alle chocoladeletters en zakelijke bestellingen bij elkaar.",
    icon: strikIcons.sinterklaas,
    tone: "yellow",
    items: [
      { href: "#", title: "Chocoladeletters", description: "", icon: strikIcons.sinterklaasLetter, accent: "yellow" },
      { href: "#", title: "B2B bestellingen", description: "", icon: strikIcons.sinterklaasB2B, accent: "green" },
    ],
  },
};

function isPreviewKey(value: string | undefined): value is PreviewKey {
  return Boolean(value && value in previews);
}

export default async function MenuPreviewPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ menu?: string; store?: string }>;
}>) {
  const params = await searchParams;
  const activeKey: PreviewKey = isPreviewKey(params.menu) ? params.menu : "winkel";
  const active = previews[activeKey];
  const activeMainKey: PreviewKey =
    activeKey === "haccp" ||
    activeKey === "winkel-temperatuurregistratie" ||
    activeKey === "afsluitplan-winkels" ||
    activeKey === "opstartplan-winkels" ||
    activeKey === "schoonmaakrooster-winkels" ||
    activeKey === "schoonmaakrooster-patisserie"
      ? "winkel"
      : activeKey === "bakkerij" ||
    activeKey === "bakkerij-haccp" ||
    activeKey === "bakkerij-temperatuurregistratie" ||
    activeKey === "bakkerij-goederenregistratie" ||
    activeKey === "bakkerij-temperaturen-overzicht" ||
    activeKey === "recepten" ||
    activeKey === "nieuw-recept" ||
    activeKey === "bruidstaart-productie"
      ? "productie"
      : activeKey === "bruidstaarten"
        ? "winkel"
      : activeKey === "bruidstaart-studio"
        ? "winkel"
      : activeKey === "bruidstaarten-overzicht"
        ? "winkel"
      : activeKey;
  const mainPreviewEntries = (
    Object.entries(previews) as [PreviewKey, MenuPreview][]
  ).filter(
    ([key]) =>
      key !== "bakkerij" &&
      key !== "bakkerij-haccp" &&
      key !== "bakkerij-temperatuurregistratie" &&
      key !== "bakkerij-goederenregistratie" &&
      key !== "bakkerij-temperaturen-overzicht" &&
      key !== "haccp" &&
      key !== "winkel-temperatuurregistratie" &&
      key !== "afsluitplan-winkels" &&
      key !== "opstartplan-winkels" &&
      key !== "schoonmaakrooster-winkels" &&
      key !== "schoonmaakrooster-patisserie" &&
      key !== "recepten" &&
      key !== "nieuw-recept" &&
      key !== "bruidstaart-productie" &&
      key !== "bruidstaarten" &&
      key !== "bruidstaart-studio" &&
      key !== "bruidstaarten-overzicht"
  );

  const toolbar = (
    <nav className="mb-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {mainPreviewEntries.map(([key, preview]) => (
          <Link
            key={key}
            href={`/menu-preview?menu=${key}`}
            className={`relative flex h-11 shrink-0 items-center rounded-full border border-white pl-12 pr-4 text-xs font-black shadow-sm transition ${
              key === activeMainKey
                ? "bg-[#d75a48] text-white"
                : "bg-[#e8eee4] text-[#49342d] hover:bg-[#c3d3bc]"
            }`}
          >
            <span className="absolute -left-px -top-px flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white bg-inherit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.icon}
                alt=""
                className={`h-8 w-8 object-contain ${
                  key === activeKey ? "brightness-0 invert" : ""
                }`}
              />
            </span>
            {preview.label}
          </Link>
        ))}
      </div>
    </nav>
  );

  if (activeKey === "bruidstaart-productie") {
    return <BruidstaartProductiePreview toolbar={toolbar} />;
  }

  if (activeKey === "bruidstaarten-overzicht") {
    return <BruidstaartenOverzichtPreview toolbar={toolbar} />;
  }

  if (activeKey === "bruidstaart-studio") {
    return (
      <StrikShell wide backHref="/menu-preview?menu=bruidstaarten">
        {toolbar}
        <StrikPageHeader
          title="Bruidstaart Studio"
          icon={strikIcons.bruidstaart}
        />
        <BruidstaartStudioConfigurator />
      </StrikShell>
    );
  }

  if (activeKey === "recepten") {
    return <ReceptenPreview toolbar={toolbar} />;
  }

  if (activeKey === "nieuw-recept") {
    return <NieuwReceptPreview toolbar={toolbar} />;
  }

  if (activeKey === "bakkerij-temperatuurregistratie") {
    return <BakeryRegistrationPreview toolbar={toolbar} kind="temperature" />;
  }

  if (activeKey === "bakkerij-goederenregistratie") {
    return <BakeryRegistrationPreview toolbar={toolbar} kind="goods" />;
  }

  if (activeKey === "bakkerij-temperaturen-overzicht") {
    return <BakeryRegistrationPreview toolbar={toolbar} kind="overview" />;
  }

  if (activeKey === "schoonmaakrooster-patisserie") {
    const storeId = ["heyendaal", "ziekerstraat", "lent", "daalseweg"].includes(
      params.store || ""
    )
      ? (params.store as "heyendaal" | "ziekerstraat" | "lent" | "daalseweg")
      : "heyendaal";

    return (
      <SchoonmaakroosterPatisseriePreview
        toolbar={toolbar}
        storeId={storeId}
      />
    );
  }

  if (activeKey === "schoonmaakrooster-winkels") {
    return (
      <SchoonmaakroosterStoreChooser
        allowedStoreIds={["heyendaal", "ziekerstraat", "lent", "daalseweg"]}
        toolbar={toolbar}
        previewMode
      />
    );
  }

  if (activeKey === "winkel-temperatuurregistratie") {
    const storeId = ["heyendaal", "ziekerstraat", "lent", "daalseweg"].includes(params.store || "") ? params.store : null;
    if (storeId) {
      const label = storeId[0].toUpperCase() + storeId.slice(1);
      return <BakeryRegistrationPreview toolbar={toolbar} kind="temperature" locationLabel={label} />;
    }

    return <WinkelTemperatureStoreChooser allowedStoreIds={["heyendaal", "ziekerstraat", "lent", "daalseweg"]} toolbar={toolbar} previewMode />;
  }

  if (activeKey === "afsluitplan-winkels" || activeKey === "opstartplan-winkels") {
    const storeId = ["heyendaal", "ziekerstraat", "lent", "daalseweg"].includes(params.store || "")
      ? (params.store as "heyendaal" | "ziekerstraat" | "lent" | "daalseweg")
      : null;

    if (storeId) {
      const planId = activeKey === "afsluitplan-winkels" ? "afsluitplan" : "opstartplan";
      const title = activeKey === "afsluitplan-winkels" ? "Afsluitplan" : "Opstartplan";

      return <WinkelPlanPreview planId={planId} title={title} storeId={storeId} toolbar={toolbar} backMenu={activeKey} />;
    }

    return (
      <SchoonmaakroosterStoreChooser
        allowedStoreIds={["heyendaal", "ziekerstraat", "lent", "daalseweg"]}
        previewMode
        planId={activeKey === "afsluitplan-winkels" ? "afsluitplan" : "opstartplan"}
        title={activeKey === "afsluitplan-winkels" ? "Afsluitplan" : "Opstartplan"}
        previewMenu={activeKey}
      />
    );
  }

  return (
    <DepartmentHub
      eyebrow={active.eyebrow}
      title={active.title}
      description={active.description}
      icon={active.icon}
      items={active.items}
      tone={active.tone}
      toolbar={toolbar}
      showBackButton={false}
      linksEnabled={
        activeKey === "winkel" ||
        activeKey === "haccp" ||
        activeKey === "bruidstaarten" ||
        activeKey === "productie" ||
        activeKey === "bakkerij"
        || activeKey === "bakkerij-haccp"
      }
    >
      {activeKey === "bruidstaarten" ? (
        <div className="flex justify-end">
          <SecondaryResourceLink
            href="https://strik-patisserie.nl/wp-content/uploads/2025/06/bruidstaart-inspiratie.pdf"
            title="Bekijk de bruidstaart voorbeelden"
            label="Inspiratie-pdf"
            icon={strikIcons.info}
            newTab
          />
        </div>
      ) : activeKey === "winkel" ? (
        <CompactStaffOverview />
      ) : null}
    </DepartmentHub>
  );
}
