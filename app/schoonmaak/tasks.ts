export type PlanType = "Opstartplan" | "Afsluitplan";

export type Task = {
  id: string;
  label: string;
  children?: Task[];
  info?: string;
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

const afsluitTakenLent: Task[] = [
  {
    id: "lent-afsluit-1",
    label: "Vitrine en werkbank schoonmaken",
    info: "Reinig de vitrine binnen en buiten, neem de werkbank af en controleer de koffiemachine en milkshakemachine.",
  },
  {
    id: "lent-afsluit-2",
    label: "Slagroom- en milkshakemachine reinigen",
    info: "Spoel de slagroommachine door met schoon water en maak de milkshakemachine schoon.",
  },
  {
    id: "lent-afsluit-3",
    label: "Koffiemachine controleren",
    info: "Verwijder restwater, maak de machine schoon en zet hem klaar voor de volgende dag.",
  },
  {
    id: "lent-afsluit-4",
    label: "Spoelbakjes en scheppen reinigen",
    info: "Spoel alle spoelbakjes, ijsscheppen en spatels goed schoon en laat ze drogen.",
  },
  {
    id: "lent-afsluit-5",
    label: "Koeling controleren",
    info: "Controleer de temperatuur van de koeling en maak de binnenkant schoon waar nodig.",
  },
  {
    id: "lent-afsluit-6",
    label: "Vloer vegen en dweilen",
    info: "Veeg eerst, dweil daarna met allesreiniger en laat geen plassen staan.",
  },
  {
    id: "lent-afsluit-7",
    label: "Prullenbakken legen",
    info: "Leeg alle prullenbakken, vervang zakken en zet het afval buiten.",
  },
  {
    id: "lent-afsluit-8",
    label: "Toilet en koffiehoek controleren",
    info: "Controleer en ruim de toilet- en koffiehoek op zodat alles netjes achterblijft.",
  },
];

const afsluitTakenHeyendaal: Task[] = [
  {
    id: "heyendaal-afsluit-1",
    label: "Vitrine en werkbank schoonmaken",
    info: "Reinig de vitrine binnen en buiten, neem de werkbank af en controleer de koffiemachine en milkshakemachine.",
  },
  {
    id: "heyendaal-afsluit-2",
    label: "Slagroom- en milkshakemachine reinigen",
    info: "Spoel de slagroommachine door met schoon water en maak de milkshakemachine schoon.",
  },
  {
    id: "heyendaal-afsluit-3",
    label: "Koffiemachine controleren",
    info: "Verwijder restwater, maak de machine schoon en zet hem klaar voor de volgende dag.",
  },
  {
    id: "heyendaal-afsluit-4",
    label: "Spoelbakjes en scheppen reinigen",
    info: "Spoel alle spoelbakjes, ijsscheppen en spatels goed schoon en laat ze drogen.",
  },
  {
    id: "heyendaal-afsluit-5",
    label: "Koeling controleren",
    info: "Controleer de temperatuur van de koeling en maak de binnenkant schoon waar nodig.",
  },
  {
    id: "heyendaal-afsluit-6",
    label: "Vloer vegen en dweilen",
    info: "Veeg eerst, dweil daarna met allesreiniger en laat geen plassen staan.",
  },
  {
    id: "heyendaal-afsluit-7",
    label: "Prullenbakken legen",
    info: "Leeg alle prullenbakken, vervang zakken en zet het afval buiten.",
  },
  {
    id: "heyendaal-afsluit-8",
    label: "Toilet en koffiehoek controleren",
    info: "Controleer en ruim de toilet- en koffiehoek op zodat alles netjes achterblijft.",
  },
];

const afsluitTakenDaalseweg: Task[] = [
  {
    id: "daalseweg-afsluit-1",
    label: "Vitrine en werkbank schoonmaken",
    info: "Reinig de vitrine binnen en buiten, neem de werkbank af en controleer de koffiemachine en milkshakemachine.",
  },
  {
    id: "daalseweg-afsluit-2",
    label: "Slagroom- en milkshakemachine reinigen",
    info: "Spoel de slagroommachine door met schoon water en maak de milkshakemachine schoon.",
  },
  {
    id: "daalseweg-afsluit-3",
    label: "Koffiemachine controleren",
    info: "Verwijder restwater, maak de machine schoon en zet hem klaar voor de volgende dag.",
  },
  {
    id: "daalseweg-afsluit-4",
    label: "Spoelbakjes en scheppen reinigen",
    info: "Spoel alle spoelbakjes, ijsscheppen en spatels goed schoon en laat ze drogen.",
  },
  {
    id: "daalseweg-afsluit-5",
    label: "Koeling controleren",
    info: "Controleer de temperatuur van de koeling en maak de binnenkant schoon waar nodig.",
  },
  {
    id: "daalseweg-afsluit-6",
    label: "Vloer vegen en dweilen",
    info: "Veeg eerst, dweil daarna met allesreiniger en laat geen plassen staan.",
  },
  {
    id: "daalseweg-afsluit-7",
    label: "Prullenbakken legen",
    info: "Leeg alle prullenbakken, vervang zakken en zet het afval buiten.",
  },
  {
    id: "daalseweg-afsluit-8",
    label: "Toilet en koffiehoek controleren",
    info: "Controleer en ruim de toilet- en koffiehoek op zodat alles netjes achterblijft.",
  },
];

const afsluitTakenZiekerstraat: Task[] = [
  {
    id: "ziekerstraat-afsluit-1",
    label: "Vitrine en werkbank schoonmaken",
    info: "Reinig de vitrine binnen en buiten, neem de werkbank af en controleer de koffiemachine en milkshakemachine.",
  },
  {
    id: "ziekerstraat-afsluit-2",
    label: "Slagroom- en milkshakemachine reinigen",
    info: "Spoel de slagroommachine door met schoon water en maak de milkshakemachine schoon.",
  },
  {
    id: "ziekerstraat-afsluit-3",
    label: "Koffiemachine controleren",
    info: "Verwijder restwater, maak de machine schoon en zet hem klaar voor de volgende dag.",
  },
  {
    id: "ziekerstraat-afsluit-4",
    label: "Spoelbakjes en scheppen reinigen",
    info: "Spoel alle spoelbakjes, ijsscheppen en spatels goed schoon en laat ze drogen.",
  },
  {
    id: "ziekerstraat-afsluit-5",
    label: "Koeling controleren",
    info: "Controleer de temperatuur van de koeling en maak de binnenkant schoon waar nodig.",
  },
  {
    id: "ziekerstraat-afsluit-6",
    label: "Vloer vegen en dweilen",
    info: "Veeg eerst, dweil daarna met allesreiniger en laat geen plassen staan.",
  },
  {
    id: "ziekerstraat-afsluit-7",
    label: "Prullenbakken legen",
    info: "Leeg alle prullenbakken, vervang zakken en zet het afval buiten.",
  },
  {
    id: "ziekerstraat-afsluit-8",
    label: "Toilet en koffiehoek controleren",
    info: "Controleer en ruim de toilet- en koffiehoek op zodat alles netjes achterblijft.",
  },
];

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
  "Ijsvitrine van binnen schoonmaken met emmer Halemid (1 schep halemid op volle emmer lauw water). Let erop dat er geen aangekoekt ijs meer zichtbaar is!":
    "LET OP! Dit hoeft alleen aan het begin van de shift, nog voordat de vitrine aanstaat. Met een schepje halemid in een emmer met warm water maak je de binnenkant van de vitrine elke dag schoon zodat er geen aangekoekt ijs of ander viezigheid meer te zien is.",
  "Ijsvitrine van buiten schoonmaken met Glassex en torkrol":
    "Het glaswerk van de vitrine wordt snel vies door ijs wat op de vitrine valt. Maak dit na iedere shift met Glassex schoon en houd tijdens je shift in de gaten of het glas er netjes uitziet.",
  "Schone sponsen en schone ijsscheppen in de spoelbakken doen":
    "Met spoelbakjes bedoelen we de twee bakjes die bij de ijsvitrine zitten waarmee je je ijsspatel schoonspoelt. Vul een kannetje met kokend heet water, giet dit in het bakje en spoel het ijs weg. Maak het bakje ook buitenkant schoon met een nat doekje.",
  "Bakje slagroom uit de koelkast halen, aanvullen en in de slagroommachine doen. 1 keer doorspoelen voor gebruik.":
    "De slagroommachine moet iedere dag goed schoon worden gemaakt. Haal de deksel van de machine en het bakje eruit. Vul een beker met lauw water en een klein beetje reiniger. Laat de machine doorlopen tot het bekertje leeg is, en herhaal daarna met alleen water.",
  "Slagroom- en milkshakemachine reinigen":
    "De slagroommachine moet dagelijks worden schoongemaakt omdat slagroom snel gaat schimmelen. Spoel de machine met reiniger door en spoel daarna nog een keer met alleen water. De milkshakemachine schoon je door een beker met lauw water te gebruiken en deze even te laten lopen.",
  "Koffiemachine controleren":
    "De koffiemachine moet iedere dag schoongemaakt worden. Laat hem even doorlopen, maak de bak met koffiedrap schoon en reinig alle losse onderdelen zoals pistolen, schuimbekertjes en stoompijpje. Één keer per week gebruik je speciale reiniger.",
  "Vloer vegen en afnemen met natte dweil en allesreiniger":
    "Het is belangrijk dat er na iedere shift wordt geveegd én gedweild. Vooral als het druk is geweest valt er veel ijs op de vloer, en als dit niet wordt schoongemaakt gaat het plakken en koekt het aan.",
  "Prullenbakken naar buiten (controleer op de zak leeg is)":
    "Na iedere shift gaat er een nieuwe zak in de vuilnisbak. Als de vuilnisbak van de buitenkant vies is, maak deze schoon met een nat doekje.",
  "Prullenbakken legen & schone zak (i.v.t)":
    "Na iedere shift gaat er een nieuwe zak in de vuilnisbak. Als de vuilnisbak van de buitenkant vies is, maak deze schoon met een nat doekje.",
  "Ijsbakjes, lepeltjes, servetten en spaarkaarten aanvullen op de vitrine":
    "Ook het toebehoren van het ijs wordt iedere dag schoongemaakt. Denk aan ijsspatels, normale spatels, hoorntjeshouders en servettenbakjes. Dit doe je met een nat doekje.",
  "Keuken schoonmaken & afwas wegwerken":
    "Ieder dag wordt de (ijs)keuken schoon achtergelaten voor de volgende dag. Zorg dat de wasbak schoon is, er geen viezigheden te zien zijn en alles netjes is opgeborgen.",
  "Keukentje schoonmaken":
    "Ieder dag wordt de (ijs)keuken schoon achtergelaten voor de volgende dag. Zorg dat de wasbak schoon is, er geen viezigheden te zien zijn en alles netjes is opgeborgen.",
};

function applyInfo(tasks: Task[]) {
  for (const task of tasks) {
    if (infoForTaskLabel[task.label]) {
      task.info = infoForTaskLabel[task.label];
    }

    if (task.children) {
      applyInfo(task.children);
    }
  }
}

applyInfo(opstartTakenPerIjssalon["ijsloket Lent"]);
applyInfo(opstartTakenPerIjssalon["ijsloket Heyendaal"]);
applyInfo(opstartTakenPerIjssalon["ijsloket Daalseweg"]);
applyInfo(opstartTakenPerIjssalon["ijsloket Ziekerstraat"]);
applyInfo(afsluitTakenLent);
applyInfo(afsluitTakenHeyendaal);
applyInfo(afsluitTakenDaalseweg);
applyInfo(afsluitTakenZiekerstraat);

export function flattenTasks(tasks: Task[]): Task[] {
  return tasks.flatMap((task) => [task, ...(task.children ? flattenTasks(task.children) : [])]);
}

export function getTakenLijst(planType: PlanType, winkel: string): Task[] {
  return takenPerPlanAndShop[planType]?.[winkel] ?? takenPerPlanAndShop[planType]["ijsloket Lent"];
}
