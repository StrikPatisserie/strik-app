import { NextResponse } from "next/server";
import { saveFolderContact } from "@/app/lib/businessFolderContacts";
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
  kind?: unknown;
  season?: unknown;
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
  consent: boolean;
  quote: boolean;
  season: "sint" | "kerst";
}) {
  const customers = Array.isArray(input.campaign.customers)
    ? input.campaign.customers
    : [];
  const consentLabel = input.quote ? `Offerteaanvraag ${input.season === "kerst" ? "Kerst" : "Sint"}: contact opgeslagen op ${input.consentAt}${input.consent ? " · Toestemming Sint + kerst" : ""}` : `Website-aanmelding Sint + kerst op ${input.consentAt}`;
  const source = input.quote ? `/${input.season}-voor-bedrijven` : "/kerst-voor-bedrijven";
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
              ...(input.consent ? { doNotEmail: false, interests: ["sint", "kerst"], consentAt: input.consentAt, consentSource: source } : {}),
            }
          : recipient
      ),
    };
  });

  if (matched) {
    return { customers: nextCustomers, alreadyRegistered: true };
  }

  const id = crypto.randomUUID();
  const recipient: MailingRecipient = {
    id: `folderadres-${id}`,
    contactName: input.contactName,
    email: input.email,
    doNotEmail: !input.consent,
    sent: [],
    interests: input.consent ? ["sint", "kerst"] : [],
    ...(input.consent ? { consentAt: input.consentAt, consentSource: source } : {}),
  };
  const sameCompany = nextCustomers.findIndex((customer) => customer.company.trim().toLowerCase() === input.company.trim().toLowerCase());
  if (sameCompany >= 0) {
    return { customers: nextCustomers.map((customer, index) => index === sameCompany ? { ...customer, notes: appendSignupNote(customer.notes, consentLabel), recipients: [...customer.recipients, recipient] } : customer), alreadyRegistered: false };
  }
  return { customers: [{ id: `folderlead-${id}`, company: input.company, notes: consentLabel, recipients: [recipient] }, ...nextCustomers], alreadyRegistered: false };
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
  const quote = input.kind === "quote";
  if (quote) return NextResponse.json({ message: "De folder is vernieuwd. Vernieuw de pagina om je volledige offerteaanvraag rechtstreeks te versturen." }, { status: 410 });
  if (!consent && !quote) {
    return NextResponse.json(
      { message: "Geef toestemming om de foldermails te ontvangen." },
      { status: 400 }
    );
  }

  const year = new Intl.DateTimeFormat("en", { timeZone: "Europe/Amsterdam", year: "numeric" }).format(new Date());
  const consentAt = new Date().toISOString();

  try {
    const campaign = await readCampaign(year);
    const merged = mergeSignup({
      campaign,
      company,
      contactName,
      email,
      consentAt,
      consent,
      quote,
      season: input.season === "kerst" ? "kerst" : "sint",
    });

    await saveCampaign(year, {
      ...campaign,
      year,
      customers: merged.customers,
    });

    const customer = merged.customers.find((customer) => customer.recipients.some((recipient) => recipient.email.toLowerCase() === email));
    if (!customer) throw new Error("Contact ontbreekt na opslaan.");
    await saveFolderContact(customer, email, consent);

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
