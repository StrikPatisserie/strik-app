import type { Metadata } from "next";
import { WEDDING_APP_ORIGIN, WEDDING_WEBSITE_ORIGIN, WEDDING_WEBSITE_PATH } from "./weddingPublicSite";

const home = `${WEDDING_WEBSITE_ORIGIN}${WEDDING_WEBSITE_PATH}`;
const image = `${WEDDING_APP_ORIGIN}/bruidstaarten/voorbeeld-1.webp`;
export function weddingPageMetadata(appointment = false): Metadata {
  const title = appointment ? "Bruidstaartafspraak inplannen · Strik Patisserie Nijmegen" : "Bruidstaarten op maat · Strik Patisserie Nijmegen";
  const description = appointment ? "Plan jullie vrijblijvende bruidstaartafspraak bij Strik aan de Ziekerstraat in Nijmegen. Kies direct een beschikbare dag en tijd." : "Ontdek klassieke, naked en crème bruidstaarten uit onze eigen bakkerij. Bekijk voorbeelden en plan een vrijblijvend gesprek bij Strik in Nijmegen.";
  const url = appointment ? `${home}/afspraak` : home;
  return {
    title, description, alternates: { canonical: url },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
    manifest: null,
    icons: {
      icon: [{ url: `${WEDDING_WEBSITE_ORIGIN}/wp-content/uploads/2025/06/cropped-favicon-32x32.png`, sizes: "32x32" }, { url: `${WEDDING_WEBSITE_ORIGIN}/wp-content/uploads/2025/06/cropped-favicon-192x192.png`, sizes: "192x192" }],
      apple: `${WEDDING_WEBSITE_ORIGIN}/wp-content/uploads/2025/06/cropped-favicon-180x180.png`,
    },
    openGraph: { type: "website", locale: "nl_NL", siteName: "Strik Patisserie", url, title, description, images: [{ url: image, alt: "Bruidstaart van Strik met crème en een waterval van echte bloemen" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export function weddingPageSchema(appointment = false) {
  const meta = weddingPageMetadata(appointment);
  const url = appointment ? `${home}/afspraak` : home;
  const crumbs = [{ "@type": "ListItem", position: 1, name: "Home", item: `${WEDDING_WEBSITE_ORIGIN}/` }, { "@type": "ListItem", position: 2, name: "Bruidstaarten", item: home }];
  if (appointment) crumbs.push({ "@type": "ListItem", position: 3, name: "Afspraak plannen", item: url });
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": `${url}#webpage`, url, name: meta.title, description: meta.description, inLanguage: "nl-NL", isPartOf: { "@id": `${WEDDING_WEBSITE_ORIGIN}/#website` }, about: { "@id": `${home}#service` }, breadcrumb: { "@id": `${url}#breadcrumb` }, primaryImageOfPage: { "@type": "ImageObject", contentUrl: image } },
    { "@type": "Service", "@id": `${home}#service`, name: "Bruidstaarten op maat", serviceType: "Ambachtelijke bruidstaarten", url: home, provider: { "@id": `${WEDDING_WEBSITE_ORIGIN}/#organization`, "@type": "Organization", name: "Strik Patisserie", url: `${WEDDING_WEBSITE_ORIGIN}/` }, areaServed: { "@type": "City", name: "Nijmegen" } },
    { "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`, itemListElement: crumbs },
  ] };
}
