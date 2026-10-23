import type { Metadata } from "next";

export const BUSINESS_WEBSITE_URL = "https://strik-patisserie.nl/zakelijk/";
const origin = "https://strik-patisserie.nl";
const image = "https://app.strik-patisserie.nl/zakelijk/gateau-bedrijf.webp";
const title = "Zakelijk · Patisserie voor bedrijven · Strik Patisserie Nijmegen";
const description = "Ambachtelijke taarten, kleine patisserie en feestdagengeschenken voor horeca, winkels en bedrijven. Uit onze bakkerij in Malden, geleverd in Nijmegen en omgeving.";

export function businessPageMetadata(): Metadata {
  return {
    title, description, alternates: { canonical: BUSINESS_WEBSITE_URL },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
    manifest: null,
    icons: {
      icon: [{ url: `${origin}/wp-content/uploads/2025/06/cropped-favicon-32x32.png`, sizes: "32x32" }, { url: `${origin}/wp-content/uploads/2025/06/cropped-favicon-192x192.png`, sizes: "192x192" }],
      apple: `${origin}/wp-content/uploads/2025/06/cropped-favicon-180x180.png`,
    },
    openGraph: { type: "website", locale: "nl_NL", siteName: "Strik Patisserie", url: BUSINESS_WEBSITE_URL, title, description, images: [{ url: image, alt: "Kleine patisserie van Strik voor een zakelijke bijeenkomst" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export function businessPageSchema() {
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": `${BUSINESS_WEBSITE_URL}#webpage`, url: BUSINESS_WEBSITE_URL, name: title, description, inLanguage: "nl-NL", isPartOf: { "@id": `${origin}/#website` }, about: { "@id": `${BUSINESS_WEBSITE_URL}#service` }, breadcrumb: { "@id": `${BUSINESS_WEBSITE_URL}#breadcrumb` }, primaryImageOfPage: { "@type": "ImageObject", contentUrl: image } },
    { "@type": "Service", "@id": `${BUSINESS_WEBSITE_URL}#service`, name: "Patisserie voor bedrijven", serviceType: "Zakelijke patisserie en geschenken", url: BUSINESS_WEBSITE_URL, provider: { "@id": `${origin}/#organization`, "@type": "Organization", name: "Strik Patisserie", url: `${origin}/` }, areaServed: { "@type": "City", name: "Nijmegen" } },
    { "@type": "BreadcrumbList", "@id": `${BUSINESS_WEBSITE_URL}#breadcrumb`, itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` }, { "@type": "ListItem", position: 2, name: "Zakelijk", item: BUSINESS_WEBSITE_URL }] },
  ] };
}
