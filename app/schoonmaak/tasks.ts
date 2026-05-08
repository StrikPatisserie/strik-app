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
    id: "lent-1",
    label: "BAKKEN SCHOONMAKEN & VOORRAAD CHECK (uur voor sluiting):",
    children: [
      {
        id: "lent-1-a",
        label: "Indien het rustig is, zorg je dat je de bakken & keuken alvast schoonmaakt (bakken schoon scheppen met oranje spatel en papier)",
      },
      {
        id: "lent-1-b",
        label: "Maak een lijstje met ijssmaken die op zijn en nodig zijn voor morgen",
      },
      {
        id: "lent-1-c",
        label: "Tafels buiten en binnen schoonmaken",
      },
      {
        id: "lent-1-d",
        label: "Prullenbakken legen & schone zak (i.v.t)",
      },
      {
        id: "lent-1-e",
        label: "Planten water geven (als het niet geregend heeft)",
      },
    ],
  },
  {
    id: "lent-2",
    label: "GROTE MACHINES SCHOONMAKEN (v.a. sluitingstijd, wel nog ijs doorverkopen!!):",
    children: [
      {
        id: "lent-2-a",
        label: "Koffiemachine schoonmaken",
      },
      {
        id: "lent-2-b",
        label: "Slagroommachine schoonmaken",
      },
      {
        id: "lent-2-c",
        label: "Milkshake machine. Eventuele milkshake resten stickeren met huidige datum en afgedekt opbergen in zwarte koeling",
      },
    ],
  },
  {
    id: "lent-3",
    label: "TERRAS OPRUIMEN",
    children: [
      {
        id: "lent-3-a",
        label: "Vuilniszakken vervangen indien ze vol zitten en klaarzetten voor de bezorger",
      },
      {
        id: "lent-3-b",
        label: "Terrastafels en stoelen schoonmaken & plantjes en kaarten naar binnen halen",
      },
      {
        id: "lent-3-c",
        label: "Groene bankjes en ijsje naar binnen zetten",
      },
      {
        id: "lent-3-d",
        label: "Luifel indraaien",
      },
    ],
  },
  {
    id: "lent-4",
    label: "IJSVITRINE AFSLUITEN",
    children: [
      {
        id: "lent-4-a",
        label: "Alle ijsbakken volledig schoonmaken met de spatel en papier. LET OP: alle randen moeten volledig schoon zijn! Geen vieze bakken in de vriezer!",
      },
      {
        id: "lent-4-b",
        label: "Indien er geen mensen meer komen, beginnen met de bakken in de -17 vriezer zetten. Geen plek meer? Zet de rest in de -22 vriezer met een briefje erop ‘DEZE EERST’.",
      },
      {
        id: "lent-4-c",
        label: "Staven uit de vitrine halen, afwassen en op een theedoek te drogen leggen",
      },
      {
        id: "lent-4-d",
        label: "Ijsvitrine uitzetten",
      },
      {
        id: "lent-4-e",
        label: "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen. Daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Daarna met een nat doekje nog een keer afdoen",
      },
      {
        id: "lent-4-f",
        label: "Hoorntjes van de vitrine halen en een plastic zak om doen! Let op: laat deze niet op de ijsvitrine staan, anders staat s’ochtends de zon erop!",
      },
      {
        id: "lent-4-g",
        label: "Doekje over gehele ijsvitrine doen voor de hele vieze stukken",
      },
      {
        id: "lent-4-h",
        label: "Foto van gevraagde onderdelen naar Roos/Eva",
      },
    ],
  },
  {
    id: "lent-5",
    label: "SCHOONMAAK SALON",
    children: [
      {
        id: "lent-5-a",
        label: "Stofzuigen & dweilen van vloer",
      },
      {
        id: "lent-5-b",
        label: "Afwas doen & keuken opruimen",
      },
      {
        id: "lent-5-c",
        label: "Vieze theedoeken en sponzen verzamelen en in kratje doen",
      },
      {
        id: "lent-5-d",
        label: "Al het afval (karton & zakken) klein maken en klaarzetten voor de bezorger in de lange gang",
      },
    ],
  },
  {
    id: "lent-6",
    label: "CONTROLE",
    children: [
      {
        id: "lent-6-a",
        label: "Voorraad check à bestel alles wat op is via het bestelsysteem op de iPad (hetgeen wat niet besteld kan worden op de iPad doormailen naar info@strik-patisserie.nl)",
      },
      {
        id: "lent-6-b",
        label: "Vriezers controleren op temperatuur en of ze goed dicht zijn!!",
      },
      {
        id: "lent-6-c",
        label: "Omzet formulieren invullen",
      },
      {
        id: "lent-6-d",
        label: "Laatste check: alles schoon/dicht/uit?",
      },
    ],
  },
];

const afsluitTakenHeyendaal: Task[] = [
  {
    id: "heyendaal-1",
    label: "BAKKEN SCHOONMAKEN & VOORRAAD CHECK (uur voor sluiting):",
    children: [
      {
        id: "heyendaal-1-a",
        label: "Indien het rustig is, zorg je dat je de bakken & keuken alvast schoonmaakt (bakken schoon scheppen met oranje spatel en papier)",
      },
      {
        id: "heyendaal-1-b",
        label: "Maak een lijstje met ijssmaken die op zijn en nodig zijn voor morgen",
      },
      {
        id: "heyendaal-1-c",
        label: "Tafels buiten en binnen schoonmaken",
      },
      {
        id: "heyendaal-1-d",
        label: "Prullenbakken legen & schone zak (i.v.t)",
      },
      {
        id: "heyendaal-1-e",
        label: "Planten water geven (als het niet geregend heeft)",
      },
    ],
  },
  {
    id: "heyendaal-2",
    label: "GROTE MACHINES SCHOONMAKEN (v.a. sluitingstijd, wel nog ijs doorverkopen!!):",
    children: [
      {
        id: "heyendaal-2-a",
        label: "Koffiemachine schoonmaken",
      },
      {
        id: "heyendaal-2-b",
        label: "Slagroommachine schoonmaken",
      },
      {
        id: "heyendaal-2-c",
        label: "Milkshake machine. Eventuele milkshake resten stickeren met huidige datum en afgedekt opbergen in zwarte koeling",
      },
    ],
  },
  {
    id: "heyendaal-3",
    label: "TERRAS OPRUIMEN",
    children: [
      {
        id: "heyendaal-3-a",
        label: "Vuilniszakken vervangen indien ze vol zitten en klaarzetten voor de bezorger",
      },
      {
        id: "heyendaal-3-b",
        label: "Terrastafels en stoelen schoonmaken & plantjes en kaarten naar binnen halen",
      },
      {
        id: "heyendaal-3-c",
        label: "Tafels en stoelen in café zetten",
      },
      {
        id: "heyendaal-3-d",
        label: "Parasols uit de voet halen en naar binnen halen",
      },
      {
        id: "heyendaal-3-e",
        label: "Luifel indraaien",
      },
    ],
  },
  {
    id: "heyendaal-4",
    label: "IJSVITRINE AFSLUITEN",
    children: [
      {
        id: "heyendaal-4-a",
        label: "Alle ijsbakken volledig schoonmaken met de spatel en papier. LET OP: alle randen moeten volledig schoon zijn! Geen vieze bakken in de vriezer!",
      },
      {
        id: "heyendaal-4-b",
        label: "Indien er geen mensen meer komen, beginnen met de bakken in de -17 vriezer zetten. Geen plek meer? Zet de rest in de -22 vriezer met een briefje erop ‘DEZE EERST’.",
      },
      {
        id: "heyendaal-4-c",
        label: "Staven uit de vitrine halen, afwassen en op een theedoek te drogen leggen",
      },
      {
        id: "heyendaal-4-d",
        label: "Ijsvitrine uitzetten",
      },
      {
        id: "heyendaal-4-e",
        label: "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen, daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Spoelbakje daarna met een nat doekje nog een keer afdoen",
      },
      {
        id: "heyendaal-4-f",
        label: "Hoorntjes van de vitrine halen en een plastic zak om doen! Let op: laat deze niet op de ijsvitrine staan, anders staat s’ochtends de zon erop!",
      },
      {
        id: "heyendaal-4-g",
        label: "Doekje over gehele ijsvitrine doen voor de hele vieze stukken",
      },
      {
        id: "heyendaal-4-h",
        label: "Foto van gevraagde onderdelen naar Roos/Eva",
      },
    ],
  },
  {
    id: "heyendaal-5",
    label: "SCHOONMAAK SALON",
    children: [
      {
        id: "heyendaal-5-a",
        label: "Stofzuigen & dweilen van vloer",
      },
      {
        id: "heyendaal-5-b",
        label: "Afwas doen & keuken opruimen",
      },
      {
        id: "heyendaal-5-c",
        label: "Vieze theedoeken en sponzen verzamelen en in kratje doen",
      },
      {
        id: "heyendaal-5-d",
        label: "Al het afval (karton & zakken) klein maken en klaarzetten voor de bezorger",
      },
    ],
  },
  {
    id: "heyendaal-6",
    label: "CONTROLE",
    children: [
      {
        id: "heyendaal-6-a",
        label: "Voorraad check à bestel alles wat op is via het bestelsysteem op de iPad (hetgeen wat niet besteld kan worden op de iPad doormailen naar info@strik-patisserie.nl)",
      },
      {
        id: "heyendaal-6-b",
        label: "Vriezers controleren op temperatuur en of ze goed dicht zijn!!",
      },
      {
        id: "heyendaal-6-c",
        label: "Omzet formulieren invullen",
      },
      {
        id: "heyendaal-6-d",
        label: "Laatste check: alles schoon/dicht/uit?",
      },
    ],
  },
];

const afsluitTakenDaalseweg: Task[] = [
  {
    id: "daalseweg-1",
    label: "BAKKEN SCHOONMAKEN & VOORRAAD CHECK (uur voor sluiting):",
    children: [
      {
        id: "daalseweg-1-a",
        label: "Indien het rustig is, zorg je dat je de bakken & keuken alvast schoonmaakt (bakken schoon scheppen met oranje spatel en papier)",
      },
      {
        id: "daalseweg-1-b",
        label: "Maak een lijstje met ijssmaken die op zijn en nodig zijn voor morgen",
      },
      {
        id: "daalseweg-1-c",
        label: "Tafels buiten en binnen schoonmaken",
      },
      {
        id: "daalseweg-1-d",
        label: "Prullenbakken legen & schone zak (i.v.t)",
      },
      {
        id: "daalseweg-1-e",
        label: "Planten water geven (als het niet geregend heeft)",
      },
    ],
  },
  {
    id: "daalseweg-2",
    label: "GROTE MACHINES SCHOONMAKEN (v.a. sluitingstijd, wel nog ijs doorverkopen!!):",
    children: [
      {
        id: "daalseweg-2-a",
        label: "Koffiemachine schoonmaken",
      },
      {
        id: "daalseweg-2-b",
        label: "Slagroommachine schoonmaken",
      },
    ],
  },
  {
    id: "daalseweg-3",
    label: "TERRAS OPRUIMEN",
    children: [
      {
        id: "daalseweg-3-a",
        label: "Vuilniszakken vervangen indien ze vol zitten en klaarzetten voor de bezorger",
      },
      {
        id: "daalseweg-3-b",
        label: "Kussentjes van de bankjes naar binnen halen",
      },
      {
        id: "daalseweg-3-c",
        label: "Ijshoorntje naar binnen",
      },
      {
        id: "daalseweg-3-d",
        label: "Luifel indraaien",
      },
    ],
  },
  {
    id: "daalseweg-4",
    label: "IJSVITRINE AFSLUITEN",
    children: [
      {
        id: "daalseweg-4-a",
        label: "Alle ijsbakken volledig schoonmaken met de spatel en papier. LET OP: alle randen moeten volledig schoon zijn! Geen vieze bakken in de vriezer!",
      },
      {
        id: "daalseweg-4-b",
        label: "Indien er geen mensen meer komen, beginnen met de bakken in de -17 vriezer zetten. Geen plek meer? Zet de rest in de -22 vriezer met een briefje erop ‘DEZE EERST’.",
      },
      {
        id: "daalseweg-4-c",
        label: "Staven uit de vitrine halen, afwassen en op een theedoek te drogen leggen",
      },
      {
        id: "daalseweg-4-d",
        label: "Ijsvitrine uitzetten",
      },
      {
        id: "daalseweg-4-e",
        label: "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen, daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Daarna met een nat doekje nog een keer afdoen",
      },
      {
        id: "daalseweg-4-f",
        label: "Hoorntjes van de vitrine halen en een plastic zak om doen! Let op: laat deze niet op de ijsvitrine staan, anders staat s’ochtends de zon erop!",
      },
      {
        id: "daalseweg-4-g",
        label: "Doekje over gehele ijsvitrine doen voor de hele vieze stukken",
      },
      {
        id: "daalseweg-4-h",
        label: "Foto van gevraagde onderdelen naar Roos/Eva",
      },
    ],
  },
  {
    id: "daalseweg-5",
    label: "SCHOONMAAK SALON",
    children: [
      {
        id: "daalseweg-5-a",
        label: "Stofzuigen & dweilen van vloer",
      },
      {
        id: "daalseweg-5-b",
        label: "Afwas doen & keuken opruimen",
      },
      {
        id: "daalseweg-5-c",
        label: "Vieze theedoeken en sponzen verzamelen en in kratje doen",
      },
      {
        id: "daalseweg-5-d",
        label: "Al het afval (karton & zakken) klein maken en klaarzetten voor de bezorger in de lange gang",
      },
    ],
  },
  {
    id: "daalseweg-6",
    label: "CONTROLE",
    children: [
      {
        id: "daalseweg-6-a",
        label: "Voorraad check à bestel alles wat op is via het bestelsysteem op de iPad (hetgeen wat niet besteld kan worden op de iPad doormailen naar info@strik-patisserie.nl)",
      },
      {
        id: "daalseweg-6-b",
        label: "Vriezers controleren op temperatuur en of ze goed dicht zijn!!",
      },
      {
        id: "daalseweg-6-c",
        label: "Omzet formulieren invullen",
      },
      {
        id: "daalseweg-6-d",
        label: "Laatste check: alles schoon/dicht/uit?",
      },
    ],
  },
];

const afsluitTakenZiekerstraat: Task[] = [
  {
    id: "ziekerstraat-1",
    label: "BAKKEN SCHOONMAKEN & VOORRAAD CHECK (uur voor sluiting):",
    children: [
      {
        id: "ziekerstraat-1-a",
        label: "Indien het rustig is, zorg je dat je de bakken & keuken alvast schoonmaakt (bakken schoon scheppen met oranje spatel en papier)",
      },
      {
        id: "ziekerstraat-1-b",
        label: "Maak een lijstje met ijssmaken die op zijn en nodig zijn voor morgen",
      },
      {
        id: "ziekerstraat-1-c",
        label: "Tafels buiten en binnen schoonmaken",
      },
      {
        id: "ziekerstraat-1-d",
        label: "Prullenbakken legen & schone zak (i.v.t)",
      },
      {
        id: "ziekerstraat-1-e",
        label: "Planten water geven (als het niet geregend heeft)",
      },
    ],
  },
  {
    id: "ziekerstraat-2",
    label: "GROTE MACHINES SCHOONMAKEN (v.a. sluitingstijd, wel nog ijs doorverkopen!!):",
    children: [
      {
        id: "ziekerstraat-2-a",
        label: "Koffiemachine schoonmaken",
      },
      {
        id: "ziekerstraat-2-b",
        label: "Slagroommachine schoonmaken",
      },
    ],
  },
  {
    id: "ziekerstraat-3",
    label: "TERRAS OPRUIMEN",
    children: [
      {
        id: "ziekerstraat-3-a",
        label: "Vuilniszakken vervangen indien ze vol zitten en klaarzetten voor de bezorger",
      },
      {
        id: "ziekerstraat-3-b",
        label: "Terrastafels en stoelen schoonmaken & plantjes en kaarten naar binnen halen, LET OP, zorg dat de bezorgers/medewerkers nog naar binnen kunnen de volgende ochtend.",
      },
      {
        id: "ziekerstraat-3-c",
        label: "Ijsje, drangpalen en bord naar binnen",
      },
    ],
  },
  {
    id: "ziekerstraat-4",
    label: "IJSVITRINE AFSLUITEN",
    children: [
      {
        id: "ziekerstraat-4-a",
        label: "Alle ijsbakken volledig schoonmaken met de spatel en papier. LET OP: alle randen moeten volledig schoon zijn! Geen vieze bakken in de vriezer!",
      },
      {
        id: "ziekerstraat-4-b",
        label: "Indien er geen mensen meer komen, beginnen met de bakken in de -17 vriezer zetten. Geen plek meer? Zet de rest in de -22 vriezer met een briefje erop ‘DEZE EERST’.",
      },
      {
        id: "ziekerstraat-4-c",
        label: "Staven uit de vitrine halen, afwassen en op een theedoek te drogen leggen",
      },
      {
        id: "ziekerstraat-4-d",
        label: "Ijsvitrine uitzetten",
      },
      {
        id: "ziekerstraat-4-e",
        label: "Spoelbakjes leeg laten lopen, en alle spullen hieruit halen, daarna schoonmaken en een aantal keer doorspoelen met heet (kokend) water! Daarna met een nat doekje nog een keer afdoen",
      },
      {
        id: "ziekerstraat-4-f",
        label: "Hoorntjes van de vitrine halen en een plastic zak om doen! Let op: laat deze niet op de ijsvitrine staan, anders staat s’ochtends de zon erop!",
      },
      {
        id: "ziekerstraat-4-g",
        label: "Doekje over gehele ijsvitrine doen voor de hele vieze stukken",
      },
      {
        id: "ziekerstraat-4-h",
        label: "Foto van gevraagde onderdelen naar Roos/Eva",
      },
    ],
  },
  {
    id: "ziekerstraat-5",
    label: "SCHOONMAAK SALON",
    children: [
      {
        id: "ziekerstraat-5-a",
        label: "Stofzuigen & dweilen van vloer",
      },
      {
        id: "ziekerstraat-5-b",
        label: "Afwas doen & keuken opruimen",
      },
      {
        id: "ziekerstraat-5-c",
        label: "Vieze theedoeken en sponzen verzamelen en in kratje doen",
      },
      {
        id: "ziekerstraat-5-d",
        label: "Al het afval (karton & zakken) klein maken en klaarzetten voor de bezorger in de lange gang",
      },
    ],
  },
  {
    id: "ziekerstraat-6",
    label: "CONTROLE",
    children: [
      {
        id: "ziekerstraat-6-a",
        label: "Voorraad check à bestel alles wat op is via het bestelsysteem op de iPad (hetgeen wat niet besteld kan worden op de iPad doormailen naar info@strik-patisserie.nl)",
      },
      {
        id: "ziekerstraat-6-b",
        label: "Vriezers controleren op temperatuur en of ze goed dicht zijn!!",
      },
      {
        id: "ziekerstraat-6-c",
        label: "Omzet formulieren invullen",
      },
      {
        id: "ziekerstraat-6-d",
        label: "Laatste check: alles schoon/dicht/uit?",
      },
    ],
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
  applyInfo(tasks, afsluitInfoForTaskLabel, { clearExistingInfo: true });
});

export function flattenTasks(tasks: Task[]): Task[] {
  return tasks.flatMap((task) => [task, ...(task.children ? flattenTasks(task.children) : [])]);
}

export function getTakenLijst(planType: PlanType, winkel: string): Task[] {
  return takenPerPlanAndShop[planType]?.[winkel] ?? takenPerPlanAndShop[planType]["ijsloket Lent"];
}
