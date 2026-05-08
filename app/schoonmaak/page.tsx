"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";

const CLEANING_API_URL = "https://strik-patisserie.nl/wp-json/strik/v1/cleaning";
const CLEANING_API_KEY = "schoonmaak-ijs-strik";

type PlanType = "Opstartplan" | "Afsluitplan";

type TemperatuurRegistratie = {
  id: string;
  naam: string;
  temperatuur: string;
};

type CleaningItem = {
  id: number;
  titel?: string;
  winkel: string;
  naam: string;
  datum: string;
  taken: string[];
  opmerking: string;
  temperatuurRegistraties?: TemperatuurRegistratie[];
};

type SchoonmaakAntwoorden = {
  planType: PlanType;
  naam: string;
  taken: string[];
  opmerking: string;
  temperatuurRegistraties: TemperatuurRegistratie[];
  verzondenSignatuur?: string;
};

const ijssalons = [
  "ijsloket Lent",
  "ijsloket Heyendaal",
  "ijsloket Daalseweg",
  "ijsloket Ziekerstraat",
];

const planOptions: { value: PlanType; label: string }[] = [
  { value: "Opstartplan", label: "Opstartplan" },
  { value: "Afsluitplan", label: "Afsluitplan" },
];

type Task = {
  id: string;
  label: string;
  children?: Task[];
};

const opstartTakenPerIjssalon: Record<string, Task[]> = {
  "ijsloket Lent": [
    {
      id: "lent-1",
      label: "Loket klaarmaken",
      children: [
        { id: "lent-1-1", label: "Prullenbakken naar buiten (controleer op de zak leeg is)" },
        { id: "lent-1-2", label: "Vlag naar buiten" },
        { id: "lent-1-3", label: "Ijshoorntje naar buiten" },
        { id: "lent-1-4", label: "Luifel uitrollen" },
      ],
    },
    {
      id: "lent-2",
      label: "IJSVITRINE SCHOONMAKEN & AANZETTEN",
      children: [
        {
          id: "lent-2-1",
          label: "Ijsvitrine van binnen schoonmaken met emmer Halemid (1 schep halemid op volle emmer lauw water). Let erop dat er geen aangekoekt ijs meer zichtbaar is!",
        },
        { id: "lent-2-2", label: "Ijsvitrine aanzetten naar -16, lamp van ijsvitrine ook aanzetten!" },
        { id: "lent-2-3", label: "Ijsvitrine van buiten schoonmaken met Glassex en torkrol" },
        { id: "lent-2-4", label: "Metalen staven in vitrine plaatsen" },
      ],
    },
    {
      id: "lent-3",
      label: "IJSVITRINE VULLEN",
      children: [
        { id: "lent-3-1", label: "Als de vitrine kouder is dan -10 graden, begin je met de ijsbakken in de vitrine zetten." },
        { id: "lent-3-2", label: "Vul de ijsvitrine zoals de vaste indeling. Zijn er smaken op waardoor je een lege plek hebt? Vul deze dan met een smaak die je wel nog op voorraad hebt." },
      ],
    },
    {
      id: "lent-4",
      label: "TOEBEHOREN KLAARZETTEN",
      children: [
        { id: "lent-4-1", label: "Houder met ijshoorntjes aanvullen (FIFO!!). LET OP: zeer breekbaar, dus voorzichtig!" },
        { id: "lent-4-2", label: "Ijsbakjes, lepeltjes, servetten en spaarkaarten aanvullen op de vitrine" },
        { id: "lent-4-3", label: "Schone sponsen en schone ijsscheppen in de spoelbakken doen" },
        { id: "lent-4-4", label: "Bakje slagroom uit de koelkast halen, aanvullen en in de slagroommachine doen. 1 keer doorspoelen voor gebruik." },
      ],
    },
    {
      id: "lent-5",
      label: "SALON SCHOONMAKEN",
      children: [
        { id: "lent-5-1", label: "Glaswerk van vitrine schoonmaken met Glassex en torkrol" },
        { id: "lent-5-2", label: "Keuken schoonmaken & afwas wegwerken" },
      ],
    },
  ],
  "ijsloket Daalseweg": [
    {
      id: "daalseweg-1",
      label: "Loket klaarmaken",
      children: [
        { id: "daalseweg-1-1", label: "Prullenbakken naar buiten (controleer op de zak leeg is)" },
        { id: "daalseweg-1-2", label: "Vlag naar buiten" },
        { id: "daalseweg-1-3", label: "Ijshoorntje naar buiten" },
        { id: "daalseweg-1-4", label: "Luifel uitrollen" },
      ],
    },
    {
      id: "daalseweg-2",
      label: "IJSVITRINE SCHOONMAKEN & AANZETTEN",
      children: [
        {
          id: "daalseweg-2-1",
          label: "Ijsvitrine van binnen schoonmaken met emmer Halemid (1 schep halemid op volle emmer lauw water). Let erop dat er geen aangekoekt ijs meer zichtbaar is!",
        },
        { id: "daalseweg-2-2", label: "Ijsvitrine aanzetten naar -16, lamp van ijsvitrine ook aanzetten!" },
        { id: "daalseweg-2-3", label: "Ijsvitrine van buiten schoonmaken met Glassex en torkrol" },
        { id: "daalseweg-2-4", label: "Metalen staven in vitrine plaatsen" },
      ],
    },
    {
      id: "daalseweg-3",
      label: "IJSVITRINE VULLEN",
      children: [
        { id: "daalseweg-3-1", label: "Als de vitrine kouder is dan -10 graden, begin je met de ijsbakken in de vitrine zetten. Pak ijsbakken uit de vriezer in het ijsloket, en vul eventueel aan met bakken uit de vriezer achter in de winkel." },
        { id: "daalseweg-3-2", label: "Vul de ijsvitrine zoals de vaste indeling. Zijn er smaken op waardoor je een lege plek hebt? Vul deze dan met een smaak die je wel nog op voorraad hebt." },
      ],
    },
    {
      id: "daalseweg-4",
      label: "TOEBEHOREN KLAARZETTEN",
      children: [
        { id: "daalseweg-4-1", label: "Houder met ijshoorntjes aanvullen (FIFO!!). LET OP: zeer breekbaar, dus voorzichtig!" },
        { id: "daalseweg-4-2", label: "Ijsbakjes, lepeltjes, servetten en spaarkaarten aanvullen op de vitrine" },
        { id: "daalseweg-4-3", label: "Schone sponsen en schone ijsscheppen in de spoelbakken doen" },
        { id: "daalseweg-4-4", label: "Bakje slagroom uit de koelkast halen, aanvullen en in de slagroommachine doen. 1 keer doorspoelen voor gebruik." },
      ],
    },
    {
      id: "daalseweg-5",
      label: "SALON SCHOONMAKEN",
      children: [
        { id: "daalseweg-5-1", label: "Glaswerk van vitrine schoonmaken met Glassex en torkrol" },
        { id: "daalseweg-5-2", label: "Keuken schoonmaken & afwas wegwerken" },
        { id: "daalseweg-5-3", label: "Keukentje schoonmaken" },
      ],
    },
  ],
  "ijsloket Heyendaal": [
    {
      id: "heyendaal-1",
      label: "TERRAS UITZETTEN",
      children: [
        { id: "heyendaal-1-1", label: "Tafels en stoeltjes op z’n plek zetten & schoonmaken met sopje" },
        { id: "heyendaal-1-2", label: "Plantjes en toebehoren op tafels" },
        { id: "heyendaal-1-3", label: "Terras aanvegen" },
        { id: "heyendaal-1-4", label: "Prullenbakken legen & schone zak (i.v.t)" },
        { id: "heyendaal-1-5", label: "Planten water geven (als het niet geregend heeft). Ook de grote bakken!" },
        { id: "heyendaal-1-6", label: "Parasols in de voeten doen en opzetten" },
        { id: "heyendaal-1-7", label: "Luifel van loket uitrollen" },
        { id: "heyendaal-1-8", label: "Groen ijsje naar buiten rollen" },
        { id: "heyendaal-1-9", label: "Lampjes aanzetten (ook bij daglicht!)" },
      ],
    },
    {
      id: "heyendaal-2",
      label: "IJSVITRINE SCHOONMAKEN & AANZETTEN",
      children: [
        {
          id: "heyendaal-2-1",
          label: "Ijsvitrine van binnen schoonmaken met emmer Halemid (1 schep halemid op volle emmer lauw water). Let erop dat er geen aangekoekt ijs meer zichtbaar is!",
        },
        { id: "heyendaal-2-2", label: "Ijsvitrine aanzetten naar -16, lamp van ijsvitrine ook aanzetten!" },
        { id: "heyendaal-2-3", label: "Ijsvitrine van buiten schoonmaken met Glassex en torkrol" },
        { id: "heyendaal-2-4", label: "Metalen staven in vitrine plaatsen" },
      ],
    },
    {
      id: "heyendaal-3",
      label: "IJSVITRINE VULLEN",
      children: [
        { id: "heyendaal-3-1", label: "Als de vitrine kouder is dan -10 graden, begin je met de ijsbakken in de vitrine zetten." },
        { id: "heyendaal-3-2", label: "Vul de ijsvitrine zoals de vaste indeling. Zijn er smaken op waardoor je een lege plek hebt? Vul deze dan met een smaak die je wel nog op voorraad hebt." },
      ],
    },
    {
      id: "heyendaal-4",
      label: "TOEBEHOREN KLAARZETTEN",
      children: [
        { id: "heyendaal-4-1", label: "Bakken met ijshoorntjes aanvullen (FIFO!!). LET OP: zeer breekbaar, dus voorzichtig!" },
        { id: "heyendaal-4-2", label: "Ijsbakjes, lepeltjes, servetten en spaarkaarten aanvullen op de vitrine" },
        { id: "heyendaal-4-3", label: "Schone sponsen en schone ijsscheppen in de spoelbakken doen" },
        { id: "heyendaal-4-4", label: "Bakje slagroom uit de koelkast halen, aanvullen en in de slagroommachine doen. 1 keer doorspoelen voor gebruik." },
      ],
    },
    {
      id: "heyendaal-5",
      label: "SALON SCHOONMAKEN",
      children: [
        { id: "heyendaal-5-1", label: "Vloer vegen en afnemen met natte dweil en allesreiniger" },
        { id: "heyendaal-5-2", label: "Keuken schoonmaken & afwas wegwerken" },
        { id: "heyendaal-5-3", label: "Glasplaat afnemen met Glassex" },
      ],
    },
  ],
  "ijsloket Ziekerstraat": [
    {
      id: "ziekerstraat-1",
      label: "TERRAS UITZETTEN",
      children: [
        { id: "ziekerstraat-1-1", label: "Tafels en stoeltjes op z’n plek zetten & schoonmaken met sopje" },
        { id: "ziekerstraat-1-2", label: "Plantjes en toebehoren op tafels" },
        { id: "ziekerstraat-1-3", label: "Terras aanvegen" },
        { id: "ziekerstraat-1-4", label: "Prullenbakken legen & schone zak (i.v.t)" },
        { id: "ziekerstraat-1-5", label: "Planten water geven (als het niet geregend heeft). Ook de grote bakken!" },
        { id: "ziekerstraat-1-6", label: "Parasols (indien het seizoen) in de voeten doen en opzetten" },
        { id: "ziekerstraat-1-7", label: "Luifel van loket uitrollen" },
        { id: "ziekerstraat-1-8", label: "Groen ijsje naar buiten rollen" },
        { id: "ziekerstraat-1-9", label: "Ijzeren palen voor loket zetten" },
      ],
    },
    {
      id: "ziekerstraat-2",
      label: "IJSVITRINE SCHOONMAKEN & AANZETTEN",
      children: [
        {
          id: "ziekerstraat-2-1",
          label: "Ijsvitrine van binnen schoonmaken met emmer Halemid (1 schep halemid op volle emmer lauw water). Let erop dat er geen aangekoekt ijs meer zichtbaar is!",
        },
        { id: "ziekerstraat-2-2", label: "Ijsvitrine aanzetten naar -16, lamp van ijsvitrine ook aanzetten!" },
        { id: "ziekerstraat-2-3", label: "Ijsvitrine van buiten schoonmaken met Glassex en torkrol" },
        { id: "ziekerstraat-2-4", label: "Metalen staven in vitrine plaatsen" },
      ],
    },
    {
      id: "ziekerstraat-3",
      label: "IJSVITRINE VULLEN",
      children: [
        { id: "ziekerstraat-3-1", label: "Als de vitrine kouder is dan -10 graden, begin je met de ijsbakken in de vitrine zetten." },
        { id: "ziekerstraat-3-2", label: "Vul de ijsvitrine zoals de vaste indeling. Zijn er smaken op waardoor je een lege plek hebt? Vul deze dan met een smaak die je wel nog op voorraad hebt." },
      ],
    },
    {
      id: "ziekerstraat-4",
      label: "TOEBEHOREN KLAARZETTEN",
      children: [
        { id: "ziekerstraat-4-1", label: "Bakken met ijshoorntjes aanvullen (FIFO!!). LET OP: zeer breekbaar, dus voorzichtig!" },
        { id: "ziekerstraat-4-2", label: "Ijsbakjes, lepeltjes, servetten en spaarkaarten aanvullen op de vitrine" },
        { id: "ziekerstraat-4-3", label: "Schone sponsen en schone ijsscheppen in de spoelbakken doen" },
        { id: "ziekerstraat-4-4", label: "Bakje slagroom uit de koelkast halen, aanvullen en in de slagroommachine doen. 1 keer doorspoelen voor gebruik." },
      ],
    },
    {
      id: "ziekerstraat-5",
      label: "SALON SCHOONMAKEN",
      children: [
        { id: "ziekerstraat-5-1", label: "Vloer vegen en afnemen met natte dweil en allesreiniger" },
        { id: "ziekerstraat-5-2", label: "Keuken schoonmaken & afwas wegwerken" },
        { id: "ziekerstraat-5-3", label: "Glasplaat afnemen met Glassex" },
      ],
    },
  ],
};

const afsluitTaken: Task[] = [
  { id: "afsluit-1", label: "Vitrine schoongemaakt" },
  { id: "afsluit-2", label: "Werkbank schoongemaakt" },
  { id: "afsluit-3", label: "Koeling gecontroleerd en schoon" },
  { id: "afsluit-4", label: "Temperatuur registratie" },
  { id: "afsluit-5", label: "Vloer geveegd en gedweild" },
  { id: "afsluit-6", label: "Afval geleegd" },
  { id: "afsluit-7", label: "Toilet gecontroleerd" },
  { id: "afsluit-8", label: "Koffiehoek schoon" },
];

const takenPerPlanAndShop: Record<PlanType, Record<string, Task[]>> = {
  Opstartplan: opstartTakenPerIjssalon,
  Afsluitplan: {
    "ijsloket Lent": afsluitTaken,
    "ijsloket Heyendaal": afsluitTaken,
    "ijsloket Daalseweg": afsluitTaken,
    "ijsloket Ziekerstraat": afsluitTaken,
  },
};

function flattenTasks(tasks: Task[]): Task[] {
  return tasks.flatMap((task) => [task, ...(task.children ? flattenTasks(task.children) : [])]);
}

function getTakenLijst(planType: PlanType, winkel: string): Task[] {
  return takenPerPlanAndShop[planType]?.[winkel] ?? takenPerPlanAndShop[planType]["ijsloket Lent"];
}

function getVandaag() {
  const vandaag = new Date();
  const jaar = vandaag.getFullYear();
  const maand = String(vandaag.getMonth() + 1).padStart(2, "0");
  const dag = String(vandaag.getDate()).padStart(2, "0");

  return `${jaar}-${maand}-${dag}`;
}

function getCleaningUrl() {
  const url = new URL(CLEANING_API_URL);
  url.searchParams.set("key", CLEANING_API_KEY);

  return url;
}

function getDraftKey(winkel: string, datum: string, planType: PlanType) {
  return `strik-schoonmaak-${datum}-${winkel}-${planType}`;
}

function maakTemperatuurId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function maakSignatuur(antwoorden: SchoonmaakAntwoorden) {
  return JSON.stringify({
    planType: antwoorden.planType,
    naam: antwoorden.naam.trim(),
    taken: antwoorden.taken,
    opmerking: antwoorden.opmerking.trim(),
    temperatuurRegistraties: antwoorden.temperatuurRegistraties.map((item) => ({
      naam: item.naam.trim(),
      temperatuur: item.temperatuur.trim(),
    })),
  });
}

export default function SchoonmaakPage() {
  const searchParams = useSearchParams();
  const planQuery = searchParams.get("plan");
  const defaultPlanType: PlanType =
    planQuery === "afsluit" ? "Afsluitplan" : "Opstartplan";

  const [planType, setPlanType] = useState<PlanType>(defaultPlanType);
  const [winkel, setWinkel] = useState("ijsloket Lent");
  const [datum, setDatum] = useState(getVandaag);
  const [naam, setNaam] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [opmerking, setOpmerking] = useState("");
  const [temperatuurRegistraties, setTemperatuurRegistraties] = useState<
    TemperatuurRegistratie[]
  >([]);
  const [verzondenSignatuur, setVerzondenSignatuur] = useState("");
  const [status, setStatus] = useState("");
  const [ladenBezig, setLadenBezig] = useState(false);
  const [verzendenBezig, setVerzendenBezig] = useState(false);

  const takenLijst = useMemo(
    () => getTakenLijst(planType, winkel),
    [planType, winkel]
  );

  const taskItems = useMemo(() => flattenTasks(takenLijst), [takenLijst]);

  const taskLabelById = useMemo(
    () => Object.fromEntries(taskItems.map((task) => [task.id, task.label])),
    [taskItems]
  );

  const taskIdByLabel = useMemo(
    () => Object.fromEntries(taskItems.map((task) => [task.label, task.id])),
    [taskItems]
  );

  const temperatuurRegistratieActief = taken
    .map((id) => taskLabelById[id] ?? id)
    .includes("Temperatuur registratie");

  useEffect(() => {
    setPlanType(defaultPlanType);
  }, [defaultPlanType]);

  useEffect(() => {
    let negeerResultaat = false;

    async function laadAntwoorden() {
      setLadenBezig(true);
      setStatus("");

      try {
        const opgeslagenConcept = localStorage.getItem(
          getDraftKey(winkel, datum, planType)
        );

        if (opgeslagenConcept) {
          const concept = JSON.parse(opgeslagenConcept) as SchoonmaakAntwoorden;

          if (negeerResultaat) return;

          const geladenTaken = (concept.taken || []).map(
            (taak) => taskIdByLabel[taak] ?? taak
          );

          setTaken(geladenTaken);
          setNaam(concept.naam || "");
          setOpmerking(concept.opmerking || "");
          setTemperatuurRegistraties(concept.temperatuurRegistraties || []);
          setVerzondenSignatuur(concept.verzondenSignatuur || "");
          setStatus("Concept geladen.");
          return;
        }

        const res = await fetch(getCleaningUrl(), { cache: "no-store" });
        const items = (await res.json()) as CleaningItem[];

        if (!res.ok || negeerResultaat) return;

        const opgeslagenItems = items.filter((item) => {
          const juisteWinkel = item.winkel === winkel;
          const juisteDatum = item.datum === datum;
          const juistePlan =
            planType === "Opstartplan"
              ? !item.titel || item.titel === planType
              : item.titel === planType;

          return juisteWinkel && juisteDatum && juistePlan;
        });

        const nieuwsteItem = opgeslagenItems[0];

        const geladenTaken = (nieuwsteItem?.taken || []).map(
          (taak) => taskIdByLabel[taak] ?? taak
        );

        setTaken(geladenTaken);
        setNaam(nieuwsteItem?.naam || "");
        setOpmerking(nieuwsteItem?.opmerking || "");
        setTemperatuurRegistraties(nieuwsteItem?.temperatuurRegistraties || []);
        setVerzondenSignatuur(
          nieuwsteItem
            ? maakSignatuur({
                planType,
                naam: nieuwsteItem.naam || "",
                taken: nieuwsteItem.taken || [],
                opmerking: nieuwsteItem.opmerking || "",
                temperatuurRegistraties: nieuwsteItem.temperatuurRegistraties || [],
              })
            : ""
        );

        if (opgeslagenItems.length > 0) {
          setStatus("Opgeslagen antwoorden geladen.");
        }
      } catch {
        if (!negeerResultaat) {
          setStatus("Eerdere antwoorden konden niet geladen worden.");
        }
      } finally {
        if (!negeerResultaat) {
          setLadenBezig(false);
        }
      }
    }

    laadAntwoorden();

    return () => {
      negeerResultaat = true;
    };
  }, [winkel, datum, planType, defaultPlanType]);

  function isComplete(task: Task): boolean {
    if (!task.children) {
      return taken.includes(task.id);
    }

    return task.children.every(isComplete);
  }

  function toggleTaak(taak: Task) {
    if (taak.children) {
      const alleGevinkt = taak.children.every(isComplete);
      const volgendeTaken = new Set(taken);

      taak.children.forEach((kind) => {
        if (alleGevinkt) {
          volgendeTaken.delete(kind.id);
        } else {
          volgendeTaken.add(kind.id);
        }
      });

      setTaken(Array.from(volgendeTaken));
      return;
    }

    setTaken((prev) =>
      prev.includes(taak.id)
        ? prev.filter((t) => t !== taak.id)
        : [...prev, taak.id]
    );
  }

  function getAntwoorden(): SchoonmaakAntwoorden {
    return {
      planType,
      naam,
      taken: taken.map((id) => taskLabelById[id] ?? id),
      opmerking,
      temperatuurRegistraties,
      verzondenSignatuur,
    };
  }

  function bewaarConcept(statusTekst = "Concept opgeslagen.") {
    const antwoorden = getAntwoorden();

    localStorage.setItem(
      getDraftKey(winkel, datum, planType),
      JSON.stringify({
        ...antwoorden,
        verzondenSignatuur:
          antwoorden.verzondenSignatuur === maakSignatuur(antwoorden)
            ? antwoorden.verzondenSignatuur
            : "",
      })
    );

    setStatus(statusTekst);
  }

  function voegTemperatuurRegistratieToe() {
    setTemperatuurRegistraties((prev) => [
      ...prev,
      { id: maakTemperatuurId(), naam: "", temperatuur: "" },
    ]);
  }

  function updateTemperatuurRegistratie(
    id: string,
    veld: "naam" | "temperatuur",
    waarde: string
  ) {
    setTemperatuurRegistraties((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [veld]: waarde } : item))
    );
  }

  function verwijderTemperatuurRegistratie(id: string) {
    setTemperatuurRegistraties((prev) => prev.filter((item) => item.id !== id));
  }

  function valideerAntwoorden() {
    if (!naam.trim()) {
      setStatus("Vul eerst je naam in.");
      return false;
    }

    if (taken.length === 0) {
      setStatus("Vink minimaal 1 taak af.");
      return false;
    }

    if (temperatuurRegistratieActief) {
      if (temperatuurRegistraties.length === 0) {
        setStatus("Voeg minimaal 1 temperatuurregistratie toe.");
        return false;
      }

      const onvolledig = temperatuurRegistraties.some(
        (item) => !item.naam.trim() || !item.temperatuur.trim()
      );

      if (onvolledig) {
        setStatus("Vul bij elke temperatuurregistratie een naam en temperatuur in.");
        return false;
      }
    }

    return true;
  }

  function opslaan() {
    bewaarConcept();
  }

  async function verzenden() {
    if (!valideerAntwoorden()) return;

    const antwoorden = getAntwoorden();
    const signatuur = maakSignatuur(antwoorden);

    if (signatuur === verzondenSignatuur) {
      setStatus("Deze lijst is al verzonden.");
      return;
    }

    setStatus("Opslaan...");
    setVerzendenBezig(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const res = await fetch(getCleaningUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titel: planType,
          winkel,
          naam: naam.trim(),
          datum,
          taken: antwoorden.taken,
          opmerking: opmerking.trim(),
          temperatuurRegistraties: temperatuurRegistraties.map((item) => ({
            naam: item.naam.trim(),
            temperatuur: item.temperatuur.trim(),
          })),
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (res.ok) {
        setVerzondenSignatuur(signatuur);
        localStorage.setItem(
          getDraftKey(winkel, datum, planType),
          JSON.stringify({ ...antwoorden, verzondenSignatuur: signatuur })
        );
        setStatus("Opgeslagen en verzonden.");
        return;
      }

      if (res.status === 403) {
        setStatus("Geen toegang vanuit WordPress. Controleer de API sleutel.");
        return;
      }

      setStatus(data?.message || "Opslaan mislukt.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("WordPress reageert niet. Probeer opnieuw.");
        return;
      }

      setStatus("Kan geen verbinding maken met WordPress.");
    } finally {
      window.clearTimeout(timeoutId);
      setVerzendenBezig(false);
    }
  }

  return (
    <StrikShell>
        <StrikPageHeader
          title={planType}
          description={`Dagelijkse ${planType === "Opstartplan" ? "opstart" : "afsluit"} checklist per ijssalon.`}
          icon={strikIcons.cleaning}
          tone="medium"
        />

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {planOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPlanType(option.value)}
                className={`rounded-2xl border p-4 text-sm font-semibold transition ${
                  planType === option.value
                    ? "border-[#93b28b] bg-[#c3d3bc]"
                    : "border-[#e7e0d8] bg-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          <select
            value={winkel}
            onChange={(e) => setWinkel(e.target.value)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          >
            {ijssalons.map((ijssalon) => (
              <option key={ijssalon}>{ijssalon}</option>
            ))}
          </select>

          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Naam medewerker"
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          {planType === "Afsluitplan" && (
            <div className="rounded-3xl bg-[#f7faf5] p-4 text-sm text-gray-700 shadow-sm">
              <p className="font-semibold">Afsluitplan</p>
              <p className="mt-2">
                Gebruik dezelfde checklist als het opstartplan. Staat er “zie
                schoonmaaklijst”? Bekijk dan het{' '}
                <a
                  href="/info"
                  target="_blank"
                  className="font-semibold text-[#3b6b43] underline"
                >
                  schoonmaakplan PDF
                </a>
                .
              </p>
            </div>
          )}

          <div className="rounded-3xl bg-white/85 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-bold">Taken</p>
              {ladenBezig && (
                <span className="text-xs font-semibold text-gray-500">
                  Laden...
                </span>
              )}
            </div>

            <div className="space-y-4">
              {takenLijst.map((taak) => (
                <div
                  key={taak.id}
                  className="space-y-3 rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleTaak(taak)}
                    className={`w-full rounded-2xl border p-4 text-left text-sm font-semibold ${
                      isComplete(taak)
                        ? "border-[#c3d3bc] bg-[#c3d3bc]"
                        : "border-[#e7e0d8] bg-white"
                    }`}
                  >
                    {isComplete(taak) ? "✓ " : ""}{taak.label}
                  </button>

                  {taak.children && (
                    <div className="space-y-2 rounded-2xl bg-white p-3">
                      {taak.children.map((subtaak) => (
                        <button
                          key={subtaak.id}
                          type="button"
                          onClick={() => toggleTaak(subtaak)}
                          className={`w-full rounded-2xl border p-3 text-left text-sm font-semibold ${
                            taken.includes(subtaak.id)
                              ? "border-[#c3d3bc] bg-[#c3d3bc]"
                              : "border-[#e7e0d8] bg-[#f8f6f3]"
                          }`}
                        >
                          {taken.includes(subtaak.id) ? "✓ " : ""}
                          {subtaak.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <textarea
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
            placeholder="Opmerking"
            className="min-h-28 w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          {temperatuurRegistratieActief && (
            <section className="rounded-3xl bg-white/85 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">Temperatuur registratie</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Voeg elke koeling of vriezer toe met temperatuur.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {temperatuurRegistraties.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-3"
                  >
                    <input
                      value={item.naam}
                      onChange={(e) =>
                        updateTemperatuurRegistratie(item.id, "naam", e.target.value)
                      }
                      placeholder="Bijv. Opslag vriezer"
                      className="mb-2 w-full rounded-xl border border-[#e7e0d8] bg-white p-3"
                    />
                    <div className="flex gap-2">
                      <input
                        value={item.temperatuur}
                        onChange={(e) =>
                          updateTemperatuurRegistratie(
                            item.id,
                            "temperatuur",
                            e.target.value
                          )
                        }
                        placeholder="Temperatuur"
                        inputMode="decimal"
                        className="min-w-0 flex-1 rounded-xl border border-[#e7e0d8] bg-white p-3"
                      />
                      <button
                        type="button"
                        onClick={() => verwijderTemperatuurRegistratie(item.id)}
                        className="rounded-xl bg-white px-4 text-sm font-bold text-[#d75a48]"
                      >
                        Wis
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={voegTemperatuurRegistratieToe}
                  className="w-full rounded-2xl border border-dashed border-[#c3d3bc] bg-[#c3d3bc]/20 p-4 text-sm font-bold"
                >
                  Koeling toevoegen
                </button>
              </div>
            </section>
          )}

          <button
            onClick={opslaan}
            className="w-full rounded-full bg-[#c3d3bc] p-4 font-bold text-[#2d2a26] shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            Opslaan
          </button>

          <button
            onClick={verzenden}
            disabled={verzendenBezig}
            className="w-full rounded-full bg-[#9fb891] p-4 font-bold text-[#2d2a26] shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            {verzendenBezig ? "Verzenden..." : "Opslaan en verzenden"}
          </button>

          {status && (
            <p className="rounded-2xl bg-white p-3 text-center text-sm shadow-sm">
              {status}
            </p>
          )}
        </div>
    </StrikShell>
  );
}
