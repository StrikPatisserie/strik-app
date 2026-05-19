export type PlanType = "Opstartplan" | "Afsluitplan";

export const afsluitPhaseOrder = [
  "Voor sluiting",
  "Machines",
  "Belangrijkste afsluitblok",
  "Schoonmaak",
  "Eindcontrole",
] as const;

export type AfsluitPhase = (typeof afsluitPhaseOrder)[number];

export type Task = {
  id: string;
  label: string;
  children?: Task[];
  info?: string;
  phase?: AfsluitPhase;
  description?: string;
  warning?: string;
  required?: boolean;
  photoRequired?: boolean;
  type?:
    | "gewone taak"
    | "controle"
    | "temperatuur"
    | "foto"
    | "waarschuwing"
    | "stap-voor-stap";
  legacyLabels?: string[];
};

export const ijssalons = [
  "ijsloket Lent",
  "ijsloket Heyendaal",
  "ijsloket Daalseweg",
  "ijsloket Ziekerstraat",
] as const;

export const planOptions: { value: PlanType; label: string }[] = [
  { value: "Opstartplan", label: "Opstartplan" },
  { value: "Afsluitplan", label: "Afsluitplan" },
];

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
        {
          id: "daalseweg-3-1",
          label: "Als de vitrine kouder is dan -10 graden, begin je met de ijsbakken in de vitrine zetten. Pak ijsbakken uit de vriezer in het ijsloket, en vul eventueel aan met bakken uit de vriezer achter in de winkel.",
        },
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

const commonBeforeClosingTasks = {
  prepBakken: {
    label: "Bakken alvast schoonmaken",
    legacy:
      "Indien het rustig is, zorg je dat je de bakken & keuken alvast schoonmaakt (bakken schoon scheppen met oranje spatel en papier)",
    info:
      "Als het rustig is: schep de bakken schoon met de oranje spatel en papier. Werk ook de keuken alvast bij. Dan is afsluiten straks rustiger.",
  },
  smaken: {
    label: "Smaken voor morgen noteren",
    legacy: "Maak een lijstje met ijssmaken die op zijn en nodig zijn voor morgen",
    info:
      "Schrijf duidelijk op welke smaken op zijn of bijna op zijn. Zo kan de ochtenddienst meteen aanvullen.",
  },
  tafels: {
    label: "Tafels schoonmaken",
    legacy: "Tafels buiten en binnen schoonmaken",
    info:
      "Neem tafels binnen en buiten af met een schoon sopdoekje. Check ook de randen en plekken waar ijs heeft gedruppeld.",
  },
  prullenbakken: {
    label: "Prullenbakken checken",
    legacy: "Prullenbakken legen & schone zak (i.v.t)",
    info:
      "Leeg volle prullenbakken en doe er een schone zak in. Maak de buitenkant schoon als die vies is.",
  },
  planten: {
    label: "Planten water geven",
    legacy: "Planten water geven (als het niet geregend heeft)",
    info:
      "Geef de planten water als het droog is geweest. Check ook planten die niet direct in het zicht staan.",
  },
};

const commonClosingTasks = {
  koffie: {
    label: "Koffiemachine",
    legacy: "Koffiemachine schoonmaken",
    info:
      "Maak de koffiemachine dagelijks schoon: lekbak legen, koffiedik weggooien, losse onderdelen afspoelen, stoompijpje afnemen en de machine laten doorspoelen.",
  },
  slagroom: {
    label: "Slagroommachine",
    legacy: "Slagroommachine schoonmaken",
    info:
      "Haal het slagroombakje eruit. Spoel de machine met lauw water en reiniger. Spoel daarna nog een keer met alleen water.",
    warning: "Slagroom bederft snel. Deze machine moet elke dag schoon.",
  },
  milkshake: {
    label: "Milkshakemachine",
    legacy:
      "Milkshake machine. Eventuele milkshake resten stickeren met huidige datum en afgedekt opbergen in zwarte koeling",
    info:
      "Laat een beker met lauw water draaien. Bewaar resten alleen afgedekt, met datumsticker, in de zwarte koeling.",
  },
  vuilnisBezorger: {
    label: "Vuilnis klaarzetten",
    legacy: "Vuilniszakken vervangen indien ze vol zitten en klaarzetten voor de bezorger",
    info:
      "Vervang volle zakken, knoop ze goed dicht en zet ze klaar op de plek waar de bezorger ze meeneemt.",
  },
  ijsbakkenSchoon: {
    label: "Bakken schoonmaken",
    legacy:
      "Alle ijsbakken volledig schoonmaken met de spatel en papier. LET OP: alle randen moeten volledig schoon zijn! Geen vieze bakken in de vriezer!",
    info:
      "Maak de bovenkant en randen van elke ijsbak schoon met spatel en papier. Er mogen geen vieze of plakkerige bakken terug de vriezer in.",
    warning: "Geen vieze ijsbakken in de vriezer.",
  },
  bakkenVriezer: {
    label: "Bakken in de vriezer zetten",
    legacy:
      "Indien er geen mensen meer komen, beginnen met de bakken in de -17 vriezer zetten. Geen plek meer? Zet de rest in de -22 vriezer met een briefje erop ‘DEZE EERST’.",
    info:
      "Zet bakken pas weg als er geen klanten meer komen. Is de -17 vriezer vol, gebruik de -22 vriezer en plak duidelijk een briefje 'DEZE EERST' op die bakken.",
  },
  staven: {
    label: "Staven afwassen",
    legacy: "Staven uit de vitrine halen, afwassen en op een theedoek te drogen leggen",
    info:
      "Haal alle metalen staven uit de vitrine, was ze af en leg ze op een schone theedoek zodat ze droog en klaar zijn voor morgen.",
  },
  vitrineUit: {
    label: "Vitrine uitzetten",
    legacy: "Ijsvitrine uitzetten",
    info: "Zet de ijsvitrine uit. Neem zichtbare ijs- en suikerresten meteen weg.",
  },
  spoelbakjes: {
    label: "Spoelbakjes schoonmaken",
    legacy:
      "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen. Daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Daarna met een nat doekje nog een keer afdoen",
    extraLegacy: [
      "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen, daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Spoelbakje daarna met een nat doekje nog een keer afdoen",
      "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen, daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Daarna met een nat doekje nog een keer afdoen",
    ],
    info:
      "Haal eerst alles uit de spoelbakjes. Laat ze leeglopen, spoel meerdere keren met kokendheet water en neem de bakjes daarna af met een nat doekje.",
  },
  hoorntjes: {
    label: "Hoorntjes weghalen",
    legacy:
      "Hoorntjes van de vitrine halen en een plastic zak om doen! Let op: laat deze niet op de ijsvitrine staan, anders staat s’ochtends de zon erop!",
    info:
      "Haal hoorntjes van de vitrine, doe er een plastic zak omheen en zet ze uit de zon.",
    warning: "Laat hoorntjes niet op de ijsvitrine staan.",
  },
  vitrineAfnemen: {
    label: "Vitrine afnemen",
    legacy: "Doekje over gehele ijsvitrine doen voor de hele vieze stukken",
    info: "Neem de hele vitrine nog een keer af, vooral plakrandjes en plekken met ijsresten.",
  },
  fotos: {
    label: "Foto's uploaden",
    legacy: "Foto van gevraagde onderdelen naar Roos/Eva",
    info:
      "Maak duidelijke foto's en upload ze onderaan in de app bij de verplichte fotovelden.",
    photoRequired: true,
    type: "foto" as const,
  },
  vloer: {
    label: "Vloer doen",
    legacy: "Stofzuigen & dweilen van vloer",
    info:
      "Stofzuig of veeg eerst goed. Dweil daarna met allesreiniger, vooral waar ijs is gevallen.",
  },
  afwas: {
    label: "Afwas en keuken",
    legacy: "Afwas doen & keuken opruimen",
    info:
      "Werk alle afwas weg, droog af waar nodig en zet alles terug op de vaste plek. Laat wasbak en werkblad schoon achter.",
  },
  doeken: {
    label: "Vieze doeken in krat",
    legacy: "Vieze theedoeken en sponzen verzamelen en in kratje doen",
    info:
      "Verzamel vieze theedoeken en sponzen in het kratje voor de was. Laat geen natte doeken los liggen.",
  },
  afval: {
    label: "Afval klaarzetten",
    legacy: "Al het afval (karton & zakken) klein maken en klaarzetten voor de bezorger in de lange gang",
    extraLegacy: [
      "Al het afval (karton & zakken) klein maken en klaarzetten voor de bezorger",
    ],
    info:
      "Maak karton klein, knoop vuilniszakken goed dicht en zet alles netjes klaar op de afgesproken plek voor de bezorger.",
  },
  voorraadBestellen: {
    label: "Voorraad bestellen",
    legacy:
      "Voorraad check à bestel alles wat op is via het bestelsysteem op de iPad (hetgeen wat niet besteld kan worden op de iPad doormailen naar info@strik-patisserie.nl)",
    info:
      "Bestel alles wat op is via het bestelsysteem op de iPad. Wat daar niet besteld kan worden, mail je naar info@strik-patisserie.nl.",
  },
  vriezers: {
    label: "Vriezers checken",
    legacy: "Vriezers controleren op temperatuur en of ze goed dicht zijn!!",
    info:
      "Controleer of alle vriezers goed dicht zitten en of de temperatuur klopt. Vul de temperatuurvelden in de app in.",
    type: "temperatuur" as const,
    warning: "Een open vriezer kan ijsverlies geven.",
  },
  omzet: {
    label: "Omzetformulieren invullen",
    legacy: "Omzet formulieren invullen",
    info: "Vul de omzetformulieren volledig en netjes in voordat je afsluit.",
  },
  laatsteCheck: {
    label: "Alles schoon, dicht en uit",
    legacy: "Laatste check: alles schoon/dicht/uit?",
    info:
      "Loop nog een laatste ronde: machines uit, deuren dicht, vriezers dicht, afval weg en salon schoon.",
    type: "controle" as const,
  },
};

function afsluitSubtask(
  id: string,
  data: {
    label: string;
    legacy: string;
    extraLegacy?: string[];
    info: string;
    warning?: string;
    type?: Task["type"];
    photoRequired?: boolean;
  }
): Task {
  return {
    id,
    label: data.label,
    info: data.info,
    warning: data.warning,
    type: data.type || "gewone taak",
    photoRequired: data.photoRequired,
    required: true,
    legacyLabels: [data.legacy, ...(data.extraLegacy || [])],
  };
}

function afsluitCard(
  id: string,
  phase: AfsluitPhase,
  label: string,
  children: Task[],
  options: Pick<Task, "description" | "warning" | "info" | "type"> = {}
): Task {
  return {
    id,
    label,
    phase,
    children,
    description: options.description,
    warning: options.warning,
    info: options.info,
    type: options.type || "stap-voor-stap",
    required: true,
  };
}

function maakAfsluitTaken(
  prefix: string,
  opties: {
    milkshake?: boolean;
    terraceTasks: Task[];
    afvalInLangeGang?: boolean;
  }
): Task[] {
  const afval = {
    ...commonClosingTasks.afval,
    legacy: opties.afvalInLangeGang
      ? commonClosingTasks.afval.legacy
      : "Al het afval (karton & zakken) klein maken en klaarzetten voor de bezorger",
  };

  return [
    afsluitCard(
      `${prefix}-voor-sluiting-ijs`,
      "Voor sluiting",
      "IJs & voorraad",
      [
        afsluitSubtask(`${prefix}-1-a`, commonBeforeClosingTasks.prepBakken),
        afsluitSubtask(`${prefix}-1-b`, commonBeforeClosingTasks.smaken),
        afsluitSubtask(`${prefix}-6-a`, commonClosingTasks.voorraadBestellen),
      ],
      {
        description: "Doe dit alvast als het rustig wordt.",
      }
    ),
    afsluitCard(
      `${prefix}-voor-sluiting-salon`,
      "Voor sluiting",
      "Salon & terras",
      [
        afsluitSubtask(`${prefix}-1-c`, commonBeforeClosingTasks.tafels),
        afsluitSubtask(`${prefix}-1-d`, commonBeforeClosingTasks.prullenbakken),
        afsluitSubtask(`${prefix}-1-e`, commonBeforeClosingTasks.planten),
      ],
      {
        description: "Maak de zichtbare plekken alvast netjes.",
      }
    ),
    afsluitCard(
      `${prefix}-machines`,
      "Machines",
      "Machines schoonmaken",
      [
        afsluitSubtask(`${prefix}-2-a`, commonClosingTasks.koffie),
        afsluitSubtask(`${prefix}-2-b`, commonClosingTasks.slagroom),
        ...(opties.milkshake
          ? [afsluitSubtask(`${prefix}-2-c`, commonClosingTasks.milkshake)]
          : []),
      ],
      {
        description: "Start rond sluitingstijd.",
        warning: "Blijf ijs verkopen als er nog klanten komen.",
      }
    ),
    afsluitCard(
      `${prefix}-terras-opruimen`,
      "Belangrijkste afsluitblok",
      "Terras opruimen",
      [
        afsluitSubtask(`${prefix}-3-a`, commonClosingTasks.vuilnisBezorger),
        ...opties.terraceTasks,
      ],
      {
        description: "Haal buiten naar binnen en laat de doorgang vrij.",
      }
    ),
    afsluitCard(
      `${prefix}-ijsvitrine-bakken`,
      "Belangrijkste afsluitblok",
      "IJs bakken wegzetten",
      [
        afsluitSubtask(`${prefix}-4-a`, commonClosingTasks.ijsbakkenSchoon),
        afsluitSubtask(`${prefix}-4-b`, commonClosingTasks.bakkenVriezer),
      ],
      {
        warning: "Geen vieze bakken terug in de vriezer.",
      }
    ),
    afsluitCard(
      `${prefix}-ijsvitrine-leegmaken`,
      "Belangrijkste afsluitblok",
      "Vitrine leegmaken",
      [
        afsluitSubtask(`${prefix}-4-c`, commonClosingTasks.staven),
        afsluitSubtask(`${prefix}-4-d`, commonClosingTasks.vitrineUit),
        afsluitSubtask(`${prefix}-4-e`, commonClosingTasks.spoelbakjes),
        afsluitSubtask(`${prefix}-4-f`, commonClosingTasks.hoorntjes),
        afsluitSubtask(`${prefix}-4-g`, commonClosingTasks.vitrineAfnemen),
      ]
    ),
    afsluitCard(
      `${prefix}-fotos`,
      "Belangrijkste afsluitblok",
      "Foto's",
      [afsluitSubtask(`${prefix}-4-h`, commonClosingTasks.fotos)],
      {
        description: "De verplichte uploadvelden staan onderaan.",
      }
    ),
    afsluitCard(
      `${prefix}-schoonmaak`,
      "Schoonmaak",
      "Laatste schoonmaak",
      [
        afsluitSubtask(`${prefix}-5-a`, commonClosingTasks.vloer),
        afsluitSubtask(`${prefix}-5-b`, commonClosingTasks.afwas),
        afsluitSubtask(`${prefix}-5-c`, commonClosingTasks.doeken),
        afsluitSubtask(`${prefix}-5-d`, afval),
      ]
    ),
    afsluitCard(
      `${prefix}-eindcontrole`,
      "Eindcontrole",
      "Laatste check",
      [
        afsluitSubtask(`${prefix}-6-b`, commonClosingTasks.vriezers),
        afsluitSubtask(`${prefix}-6-c`, commonClosingTasks.omzet),
        afsluitSubtask(`${prefix}-6-d`, commonClosingTasks.laatsteCheck),
      ],
    ),
  ];
}

const afsluitTakenLent: Task[] = maakAfsluitTaken("lent", {
  milkshake: true,
  afvalInLangeGang: true,
  terraceTasks: [
    afsluitSubtask("lent-3-b", {
      label: "Tafels en stoelen naar binnen",
      legacy: "Terrastafels en stoelen schoonmaken & plantjes en kaarten naar binnen halen",
      info: "Neem tafels en stoelen af. Haal plantjes en kaarten naar binnen.",
    }),
    afsluitSubtask("lent-3-c", {
      label: "Bankjes en ijsje naar binnen",
      legacy: "Groene bankjes en ijsje naar binnen zetten",
      info: "Zet de groene bankjes en het ijsje binnen op de vaste plek.",
    }),
    afsluitSubtask("lent-3-d", {
      label: "Luifel indraaien",
      legacy: "Luifel indraaien",
      info: "Draai de luifel rustig helemaal in en controleer of hij goed vastzit.",
    }),
  ],
});

const afsluitTakenHeyendaal: Task[] = maakAfsluitTaken("heyendaal", {
  milkshake: true,
  terraceTasks: [
    afsluitSubtask("heyendaal-3-b", {
      label: "Tafels en stoelen schoon",
      legacy: "Terrastafels en stoelen schoonmaken & plantjes en kaarten naar binnen halen",
      info: "Neem tafels en stoelen af. Haal plantjes en kaarten naar binnen.",
    }),
    afsluitSubtask("heyendaal-3-c", {
      label: "Meubels in cafe zetten",
      legacy: "Tafels en stoelen in café zetten",
      info: "Zet tafels en stoelen binnen in het cafe op de afgesproken plek.",
    }),
    afsluitSubtask("heyendaal-3-d", {
      label: "Parasols naar binnen",
      legacy: "Parasols uit de voet halen en naar binnen halen",
      info: "Haal parasols uit de voet en zet ze binnen. Doe dit rustig met twee handen.",
    }),
    afsluitSubtask("heyendaal-3-e", {
      label: "Luifel indraaien",
      legacy: "Luifel indraaien",
      info: "Draai de luifel rustig helemaal in en controleer of hij goed vastzit.",
    }),
  ],
});

const afsluitTakenDaalseweg: Task[] = maakAfsluitTaken("daalseweg", {
  afvalInLangeGang: true,
  terraceTasks: [
    afsluitSubtask("daalseweg-3-b", {
      label: "Kussens naar binnen",
      legacy: "Kussentjes van de bankjes naar binnen halen",
      info: "Haal de kussens van de bankjes en leg ze binnen op de vaste plek.",
    }),
    afsluitSubtask("daalseweg-3-c", {
      label: "Ijshoorntje naar binnen",
      legacy: "Ijshoorntje naar binnen",
      info: "Zet het ijshoorntje binnen op de vaste plek.",
    }),
    afsluitSubtask("daalseweg-3-d", {
      label: "Luifel indraaien",
      legacy: "Luifel indraaien",
      info: "Draai de luifel rustig helemaal in en controleer of hij goed vastzit.",
    }),
  ],
});

const afsluitTakenZiekerstraat: Task[] = maakAfsluitTaken("ziekerstraat", {
  afvalInLangeGang: true,
  terraceTasks: [
    afsluitSubtask("ziekerstraat-3-b", {
      label: "Terras naar binnen",
      legacy:
        "Terrastafels en stoelen schoonmaken & plantjes en kaarten naar binnen halen, LET OP, zorg dat de bezorgers/medewerkers nog naar binnen kunnen de volgende ochtend.",
      info:
        "Neem tafels en stoelen af. Haal plantjes en kaarten naar binnen. Zorg dat medewerkers en bezorgers morgenochtend naar binnen kunnen.",
      warning: "Laat de doorgang vrij voor morgenochtend.",
    }),
    afsluitSubtask("ziekerstraat-3-c", {
      label: "IJsje, palen en bord naar binnen",
      legacy: "Ijsje, drangpalen en bord naar binnen",
      info: "Zet het ijsje, de drangpalen en het bord binnen op de vaste plek.",
    }),
  ],
});

export const takenPerPlanAndShop: Record<PlanType, Record<string, Task[]>> = {
  Opstartplan: opstartTakenPerIjssalon,
  Afsluitplan: {
    "ijsloket Lent": afsluitTakenLent,
    "ijsloket Heyendaal": afsluitTakenHeyendaal,
    "ijsloket Daalseweg": afsluitTakenDaalseweg,
    "ijsloket Ziekerstraat": afsluitTakenZiekerstraat,
  },
};

const infoForTaskLabel: Record<string, string> = {
  "IJSVITRINE SCHOONMAKEN & AANZETTEN":
    "Maak de vitrine schoon voordat hij helemaal koud is. Werk van binnen naar buiten en controleer daarna of de vitrine en lamp aanstaan.",
  "Ijsvitrine van binnen schoonmaken met emmer Halemid (1 schep halemid op volle emmer lauw water). Let erop dat er geen aangekoekt ijs meer zichtbaar is!":
    "LET OP! Dit doe je aan het begin van de shift, nog voordat de vitrine aanstaat. Gebruik 1 schep Halemid op een volle emmer lauw water en haal al het aangekoekte ijs en vuil weg.",
  "Ijsvitrine van buiten schoonmaken met Glassex en torkrol":
    "Het glas van de vitrine wordt snel vies door ijs en vingers. Maak het na iedere shift schoon met Glassex en torkrol, en houd tijdens de shift in de gaten of het netjes blijft.",
  "Schone sponsen en schone ijsscheppen in de spoelbakken doen":
    "Met spoelbakjes bedoelen we de twee bakjes bij de ijsvitrine waarmee je de ijsspatel schoonspoelt. Vul met schoon water en zet er schone sponsen en scheppen in.",
  "Bakje slagroom uit de koelkast halen, aanvullen en in de slagroommachine doen. 1 keer doorspoelen voor gebruik.":
    "Controleer of het bakje schoon is en vul slagroom netjes aan. Spoel de machine 1 keer door voordat je hem gebruikt.",
  "Ijsbakjes, lepeltjes, servetten en spaarkaarten aanvullen op de vitrine":
    "Vul alles aan volgens FIFO: oude voorraad eerst naar voren, nieuwe voorraad erachter. Neem houders en bakjes meteen af met een nat doekje als ze vies zijn.",
  "Keuken schoonmaken & afwas wegwerken":
    "Laat de keuken schoon achter: afwas weg, wasbak schoon, werkblad afgenomen en losse spullen terug op hun vaste plek.",
  "Keukentje schoonmaken":
    "Laat het keukentje schoon achter: afwas weg, wasbak schoon, werkblad afgenomen en losse spullen terug op hun vaste plek.",
  "Vloer vegen en afnemen met natte dweil en allesreiniger":
    "Veeg eerst goed, dweil daarna met allesreiniger. Let vooral op plekken waar ijs is gevallen, anders gaat het plakken en aankoeken.",
  "Glasplaat afnemen met Glassex":
    "Maak de glasplaat schoon met Glassex en torkrol zodat er geen vingers, strepen of ijsresten zichtbaar blijven.",
  "Prullenbakken naar buiten (controleer op de zak leeg is)":
    "Na iedere shift gaat er een schone zak in de prullenbak. Is de buitenkant vies, maak die dan schoon met een nat doekje.",
  "Prullenbakken legen & schone zak (i.v.t)":
    "Na iedere shift gaat er een schone zak in de prullenbak. Is de buitenkant vies, maak die dan schoon met een nat doekje.",
  "Planten water geven (als het niet geregend heeft)":
    "Geef de planten water als het droog is geweest. Controleer ook planten die niet direct in het zicht staan.",
  "Planten water geven (als het niet geregend heeft). Ook de grote bakken!":
    "Geef de planten water als het droog is geweest. Vergeet bij Heyendaal en Ziekerstraat de grote bakken niet.",
  "Indien het rustig is, zorg je dat je de bakken & keuken alvast schoonmaakt (bakken schoon scheppen met oranje spatel en papier)":
    "Gebruik rustige momenten slim: schep de bakken alvast schoon met de oranje spatel en papier, en werk de keuken bij zodat het afsluiten sneller gaat.",
  "Maak een lijstje met ijssmaken die op zijn en nodig zijn voor morgen":
    "Noteer duidelijk welke smaken op zijn of bijna op zijn, zodat de volgende dag genoeg voorraad klaarstaat.",
  "Tafels buiten en binnen schoonmaken":
    "Neem tafels buiten en binnen af met een schoon sopdoekje. Controleer ook randen en plekken waar ijs heeft gedruppeld.",
  "GROTE MACHINES SCHOONMAKEN (v.a. sluitingstijd, wel nog ijs doorverkopen!!):":
    "Begin hiermee vanaf sluitingstijd, maar blijf ijs verkopen als er nog klanten komen. Maak koffiemachine, slagroommachine en milkshakemachine rustig en volledig schoon.",
  "Koffiemachine schoonmaken":
    "Maak de koffiemachine dagelijks schoon: lekbak legen, koffiedik weggooien, losse onderdelen afspoelen, stoompijpje afnemen en de machine laten doorspoelen.",
  "Slagroommachine schoonmaken":
    "Slagroom bederft snel, dus deze machine moet elke dag schoon. Haal het bakje eruit, spoel met lauw water en reiniger, en spoel daarna nog een keer met alleen water.",
  "Milkshake machine. Eventuele milkshake resten stickeren met huidige datum en afgedekt opbergen in zwarte koeling":
    "Maak de milkshakemachine schoon door een beker met lauw water te laten draaien. Resten alleen bewaren als ze netjes zijn afgedekt, gestickerd met datum en in de zwarte koeling staan.",
  "IJSVITRINE AFSLUITEN":
    "Werk schoon en precies: bakken schoonmaken, vitrine leegmaken, spoelbakjes reinigen en alles klaarzetten voor de volgende ochtend.",
  "Alle ijsbakken volledig schoonmaken met de spatel en papier. LET OP: alle randen moeten volledig schoon zijn! Geen vieze bakken in de vriezer!":
    "Maak de bovenkant en randen van elke ijsbak schoon met spatel en papier. Er mogen geen vieze of plakkerige bakken terug de vriezer in.",
  "Indien er geen mensen meer komen, beginnen met de bakken in de -17 vriezer zetten. Geen plek meer? Zet de rest in de -22 vriezer met een briefje erop ‘DEZE EERST’.":
    "Zet bakken pas weg als er geen klanten meer komen. Is de -17 vriezer vol, gebruik de -22 vriezer en plak duidelijk een briefje 'DEZE EERST' op die bakken.",
  "Staven uit de vitrine halen, afwassen en op een theedoek te drogen leggen":
    "Haal alle metalen staven uit de vitrine, was ze af en leg ze op een schone theedoek zodat ze droog en klaar zijn voor morgen.",
  "Ijsvitrine uitzetten":
    "Zet de ijsvitrine uit en maak hem schoon als er ijs of suiker op zit.",
  "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen. Daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Daarna met een nat doekje nog een keer afdoen":
    "Haal eerst alles uit de spoelbakjes. Laat ze leeglopen, spoel meerdere keren met heet water en neem de bakjes daarna nog af met een nat doekje.",
  "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen, daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Spoelbakje daarna met een nat doekje nog een keer afdoen":
    "Haal eerst alles uit de spoelbakjes. Laat ze leeglopen, spoel meerdere keren met heet water en neem de bakjes daarna nog af met een nat doekje.",
  "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen, daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Daarna met een nat doekje nog een keer afdoen":
    "Haal eerst alles uit de spoelbakjes. Laat ze leeglopen, spoel meerdere keren met heet water en neem de bakjes daarna nog af met een nat doekje.",
  "Hoorntjes van de vitrine halen en een plastic zak om doen! Let op: laat deze niet op de ijsvitrine staan, anders staat s’ochtends de zon erop!":
    "Haal hoorntjes van de vitrine, doe er een plastic zak omheen en zet ze uit de zon. Laat ze niet op de vitrine staan.",
  "Doekje over gehele ijsvitrine doen voor de hele vieze stukken":
    "Neem de hele vitrine nog een keer af, vooral plekken met ijsresten, plakrandjes of stof.",
  "Foto van gevraagde onderdelen naar Roos/Eva":
    "Maak de gevraagde foto's duidelijk en controleer of alles erop staat. In de app upload je de foto's bij de verplichte fotovelden.",
  "Vuilniszakken vervangen indien ze vol zitten en klaarzetten voor de bezorger":
    "Vervang volle zakken, knoop ze goed dicht en zet ze klaar op de plek waar de bezorger ze meeneemt.",
  "Terrastafels en stoelen schoonmaken & plantjes en kaarten naar binnen halen":
    "Neem tafels en stoelen af, haal plantjes en kaarten naar binnen en laat het terras netjes achter.",
  "Terrastafels en stoelen schoonmaken & plantjes en kaarten naar binnen halen, LET OP, zorg dat de bezorgers/medewerkers nog naar binnen kunnen de volgende ochtend.":
    "Neem tafels en stoelen af, haal plantjes en kaarten naar binnen en zorg dat de doorgang voor bezorgers en medewerkers vrij blijft.",
  "Luifel indraaien":
    "Draai de luifel rustig helemaal in en controleer of hij goed vastzit.",
  "SCHOONMAAK SALON":
    "Laat de salon zo achter dat de ochtenddienst direct schoon kan starten: vloer, keuken, afwas, textiel en afval op orde.",
  "Stofzuigen & dweilen van vloer":
    "Stofzuig of veeg eerst goed, dweil daarna met allesreiniger. Let vooral op plekken waar ijs is gevallen, anders gaat het plakken en aankoeken.",
  "Afwas doen & keuken opruimen":
    "Werk alle afwas weg, droog af waar nodig en zet alles terug op de vaste plek. Laat de wasbak en het werkblad schoon achter.",
  "Vieze theedoeken en sponzen verzamelen en in kratje doen":
    "Verzamel vieze theedoeken en sponzen in het kratje, zodat ze mee kunnen met de was. Laat geen natte doeken los liggen.",
  "Al het afval (karton & zakken) klein maken en klaarzetten voor de bezorger in de lange gang":
    "Maak karton klein, knoop vuilniszakken goed dicht en zet alles netjes klaar op de afgesproken plek voor de bezorger.",
  "Al het afval (karton & zakken) klein maken en klaarzetten voor de bezorger":
    "Maak karton klein, knoop vuilniszakken goed dicht en zet alles netjes klaar op de afgesproken plek voor de bezorger.",
  "CONTROLE":
    "Loop aan het einde alles nog een keer na: voorraad, vriezers, omzetformulieren en of alles schoon, dicht en uit is.",
  "Voorraad check à bestel alles wat op is via het bestelsysteem op de iPad (hetgeen wat niet besteld kan worden op de iPad doormailen naar info@strik-patisserie.nl)":
    "Bestel alles wat op is via het bestelsysteem op de iPad. Wat daar niet besteld kan worden, mail je door naar info@strik-patisserie.nl.",
  "Vriezers controleren op temperatuur en of ze goed dicht zijn!!":
    "Controleer of alle vriezers goed dicht zitten en de temperatuur klopt. Dit voorkomt ijsverlies in de nacht.",
  "Omzet formulieren invullen":
    "Vul de omzetformulieren volledig en netjes in voordat je afsluit.",
  "Laatste check: alles schoon/dicht/uit?":
    "Loop nog een laatste ronde: machines uit, deuren dicht, vriezers dicht, afval weg en salon schoon.",
};

const spoelbakjesAfsluitInfo =
  "Met spoelbakjes bedoelen we de twee bakjes die gevestigd zitten aan de ijsvitrine waarmee je je ijsspatel schoonspoelt. Deze moeten na iedere dag goed schoon worden gemaakt, omdat ze snel verstopt kunnen raken met overtollig ijs of stukjes koek wat aan de spatel vastzit. Het schoonmaken hiervan is erg simpel: vul een kannetje met kokendheet water en gooi deze in het bakje. Het ijs smelt direct en loopt goed door. Herhaal indien nodig en maak het bakje van de buitenkant nog even goed schoon met een nat doekje";

const afsluitInfoForTaskLabel: Record<string, string> = {
  "Koffiemachine schoonmaken":
    "De koffiemachine moet iedere dag schoongemaakt worden. Dit is gemakkelijk te doen door als eerste de machine even door te laten spoelen (knop met 3 bolletjes). De bak met koffiedrap moet geleegd worden en schoongemaakt worden. Daarnaast maak je alle losse onderdelen schoon: de pistolen, schuimbekertjes, stoompijpje etc. Één keer per week moet de koffiemachine schoongemaakt worden met een speciale machinereiniger. Hiervan doe je een schepje in een pistool, die je in de machine draait (alsof je een koffie gaat zetten). Als het pistool erin zit, druk je 10 keer achter elkaar, op het knopje met de drie bolletjes. Op die manier spoel je de machine van binnen schoon. Na 10 keer drukken haal je het pistool eruit, en laat je de machine nog een keer even doorspoelen.",
  "Slagroommachine schoonmaken":
    "De slagroommachine moet iedere dag goed schoon worden gemaakt. De slagroom blijft gemakkelijk zitten in de pijpjes van de machine en kan snel gaan schimmelen. De slagroommachine maak je als volgt schoon. Haal de deksel van de machine en haal het plastic bakje met slagroom eruit, deze zet je apart in een koeling. Vervolgens vul je een grote milkshake beker met lauw water én een klein scheutje slagroommachinereiniger (witte fles). Dit bekertje zet je in de machine, op de plek waar het plastic bakje stond. Het pijpje stop je in het bekertje. Vervolgens hou je een ander bekertje onder de machine, en laat je de machine volledig doorlopen, net zolang totdat het bekertje in de machine leeg is. Je ziet het overige slagroom weglopen, en op een gegeven moment wordt het water doorzichtig. Omdat je met een chemische stof werkt in de machine, herhaal je dit proces opnieuw, maar dan met een bekertje waar ALLEEN water in zit, dus geen reiniger! Als je hem voor de tweede keer hebt laten doorlopen, is de machine van de binnenkant schoon. Vervolgens haal je de losse onderdelen van de machine en maak je die apart schoon.",
  "Milkshake machine. Eventuele milkshake resten stickeren met huidige datum en afgedekt opbergen in zwarte koeling":
    "De milkshakemachine moet na ieder gebruik schoongemaakt worden voor de volgende keer. Dit is erg gemakkelijk! Vul de milkshakebeker tot ongeveer de helft van de beker met lauw water. Stop de beker in de machine en laat hem even lopen. Als je hem eruit haalt is de machine goed schoon. De beker was je even apart om.",
  "Vuilniszakken vervangen indien ze vol zitten en klaarzetten voor de bezorger":
    "Na iedere shift gaat er een nieuwe zak (mits hij niet vol is natuurlijk) in de vuilnisbak. Als de vuilnisbak van de buitenkant vies is moet deze schoongemaakt worden met een nat doekje.",
  "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen. Daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Daarna met een nat doekje nog een keer afdoen":
    spoelbakjesAfsluitInfo,
  "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen, daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Spoelbakje daarna met een nat doekje nog een keer afdoen":
    spoelbakjesAfsluitInfo,
  "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen, daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Daarna met een nat doekje nog een keer afdoen":
    spoelbakjesAfsluitInfo,
};

function applyInfo(
  tasks: Task[],
  infoByLabel: Record<string, string>,
  options: { clearExistingInfo?: boolean } = {}
) {
  for (const task of tasks) {
    if (options.clearExistingInfo) {
      delete task.info;
    }

    task.info = task.info || infoByLabel[task.label];

    if (task.children) {
      applyInfo(task.children, infoByLabel, options);
    }
  }
}

Object.values(takenPerPlanAndShop.Opstartplan).forEach((tasks) => {
  applyInfo(tasks, infoForTaskLabel);
});

Object.values(takenPerPlanAndShop.Afsluitplan).forEach((tasks) => {
  applyInfo(tasks, afsluitInfoForTaskLabel);
});

export function flattenTasks(tasks: Task[]): Task[] {
  return tasks.flatMap((task) => [task, ...(task.children ? flattenTasks(task.children) : [])]);
}

export function getTaskLabelAliases(task: Task): string[] {
  return [task.label, ...(task.legacyLabels || [])];
}

export function getTakenLijst(planType: PlanType, winkel: string): Task[] {
  return takenPerPlanAndShop[planType]?.[winkel] ?? takenPerPlanAndShop[planType]["ijsloket Lent"];
}
