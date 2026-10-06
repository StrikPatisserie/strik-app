import { NextResponse } from "next/server";
import { b2bCustomers2024 } from "@/app/api/sinterklaas-mailing/seed2024";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORDPRESS_SINTERKLAAS_API_BASE =
  process.env.WORDPRESS_SINTERKLAAS_API_BASE ||
  "https://strik-patisserie.nl/wp-json/strik/v1";
const SINTERKLAAS_API_KEY =
  process.env.WORDPRESS_SINTERKLAAS_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

type MailingRecipient = {
  id: string;
  contactName: string;
  email: string;
  doNotEmail: boolean;
  sent: unknown[];
  interests?: string[];
  consentAt?: string;
  consentSource?: string;
};

type MailingCustomer = {
  id: string;
  company: string;
  notes: string;
  recipients: MailingRecipient[];
  ordered?: boolean;
  orderedAt?: string;
};

type MailingCampaign = {
  year?: string;
  customers?: MailingCustomer[];
  [key: string]: unknown;
};

type SignupInput = {
  company?: unknown;
  contactName?: unknown;
  email?: unknown;
  consent?: unknown;
  website?: unknown;
};

function seedCustomers(): MailingCustomer[] {
  return b2bCustomers2024.map((customer) => ({
    ...customer,
    recipients: customer.recipients.map((recipient) => ({
      ...recipient,
      sent: [...recipient.sent],
    })),
  }));
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 254).toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function wordpressMailingUrl(year: string) {
  const url = new URL(
    `${WORDPRESS_SINTERKLAAS_API_BASE}/sinterklaas-mailing`
  );
  url.searchParams.set("key", SINTERKLAAS_API_KEY);
  url.searchParams.set("year", year);

  return url;
}

async function readCampaign(year: string) {
  const response = await fetch(wordpressMailingUrl(year), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`WordPress mailing ophalen mislukt (${response.status}).`);
  }

  const campaign = (await response.json()) as MailingCampaign;
  const customers = Array.isArray(campaign.customers)
    ? campaign.customers
    : [];

  return {
    ...campaign,
    year,
    customers: customers.length ? customers : seedCustomers(),
  } satisfies MailingCampaign;
}

async function saveCampaign(year: string, campaign: MailingCampaign) {
  const response = await fetch(wordpressMailingUrl(year), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(campaign),
  });

  if (!response.ok) {
    throw new Error(`WordPress mailing opslaan mislukt (${response.status}).`);
  }
}

function appendSignupNote(current: string, consentLabel: string) {
  const note = cleanText(current, 1400);
  if (note.includes(consentLabel)) return note;

  return [note, consentLabel].filter(Boolean).join(" · ").slice(0, 1600);
}

function mergeSignup(input: {
  campaign: MailingCampaign;
  company: string;
  contactName: string;
  email: string;
  consentAt: string;
}) {
  const customers = Array.isArray(input.campaign.customers)
    ? input.campaign.customers
    : [];
  const consentLabel = `Website-aanmelding Sint + kerst op ${input.consentAt}`;
  let matched = false;

  const nextCustomers = customers.map((customer) => {
    if (matched || !Array.isArray(customer.recipients)) return customer;

    const recipientIndex = customer.recipients.findIndex(
      (recipient) => recipient.email.trim().toLowerCase() === input.email
    );
    if (recipientIndex < 0) return customer;

    matched = true;
    return {
      ...customer,
      company: cleanText(customer.company, 180) || input.company,
      notes: appendSignupNote(customer.notes, consentLabel),
      recipients: customer.recipients.map((recipient, index) =>
        index === recipientIndex
          ? {
              ...recipient,
              contactName:
                cleanText(recipient.contactName, 160) || input.contactName,
              email: input.email,
              doNotEmail: false,
              interests: ["sint", "kerst"],
              consentAt: input.consentAt,
              consentSource: "/kerst-voor-bedrijven",
            }
          : recipient
      ),
    };
  });

  if (matched) {
    return { customers: nextCustomers, alreadyRegistered: true };
  }

  const id = crypto.randomUUID();
  return {
    customers: [
      {
        id: `folderlead-${id}`,
        company: input.company,
        notes: consentLabel,
        recipients: [
          {
            id: `folderadres-${id}`,
            contactName: input.contactName,
            email: input.email,
            doNotEmail: false,
            sent: [],
            interests: ["sint", "kerst"],
            consentAt: input.consentAt,
            consentSource: "/kerst-voor-bedrijven",
          },
        ],
      },
      ...nextCustomers,
    ],
    alreadyRegistered: false,
  };
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ message: "Ongeldige aanvraag." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8_000) {
    return NextResponse.json({ message: "Aanmelding is te groot." }, { status: 413 });
  }

  let input: SignupInput;
  try {
    input = (await request.json()) as SignupInput;
  } catch {
    return NextResponse.json({ message: "Aanmelding kon niet worden gelezen." }, { status: 400 });
  }

  // Stil honeypotveld voor eenvoudige formulierbots.
  if (cleanText(input.website, 200)) {
    return NextResponse.json({ ok: true });
  }

  const company = cleanText(input.company, 180);
  const contactName = cleanText(input.contactName, 160);
  const email = cleanEmail(input.email);
  const consent = input.consent === true;

  if (!company) {
    return NextResponse.json({ message: "Vul de bedrijfsnaam in." }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ message: "Vul een geldig e-mailadres in." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json(
      { message: "Geef toestemming om de foldermails te ontvangen." },
      { status: 400 }
    );
  }

  const year = String(new Date().getFullYear());
  const consentAt = new Date().toISOString();

  try {
    const campaign = await readCampaign(year);
    const merged = mergeSignup({
      campaign,
      company,
      contactName,
      email,
      consentAt,
    });

    await saveCampaign(year, {
      ...campaign,
      year,
      customers: merged.customers,
    });

    return NextResponse.json({
      ok: true,
      alreadyRegistered: merged.alreadyRegistered,
    });
  } catch (error) {
    console.error("Business folder signup failed", error);
    return NextResponse.json(
      {
        message:
          "Aanmelden lukt nu even niet. Probeer het later opnieuw of mail info@strik-patisserie.nl.",
      },
      { status: 502 }
    );
  }
}
