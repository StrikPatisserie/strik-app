import { BUSINESS_FOLDER_PRICE_TIERS, businessFolderRetailPrice } from "@/app/lib/business-folder-pricing";

export type ChristmasProduct = {
  id: string;
  name: string;
  detail: string;
  retailPriceIncl: number;
  image?: string;
  veganOption?: boolean;
};

export type ChristmasStory = {
  src: string;
  poster: string;
  description: string;
};

type ChristmasHighlight = {
  id: string;
  title: string;
  description: string;
  productIds: string[];
  story?: ChristmasStory;
};

export const christmasImages = {
  stol: "/Kerst/Feestelijke kerststol met marsepein.png",
  tulband: "/Kerst/Feestelijke tulband met kerstgeschenkdoos.png",
  amandel: "/Kerst/Feestelijke amandelkrans en staaf met kerstverpakking.jpg",
  cake: "/Kerst/2020-Kruidcake-kerst-2022.jpg",
  bonbons: "/Kerst/2023-XMAS-bonbon-giftbox-3601.jpg",
  chocolate: "/Kerst/2020-Kerst-krans-puur.jpg",
  cookies: "/Kerst/2021-Kerst-koekkrans.jpg",
  meringues: "/Kerst/2021-kerst-schuim.jpg",
  christmasChocolate: "/Kerst/2021-Kerst-Kerstchoco-2.jpg",
  package: "/Kerst/Pastelgroene patisseriedoos met kerstdecoratie.png",
};

export const christmasProducts: ChristmasProduct[] = [
  { id: "stol-groot", name: "Kerststol", detail: "800 gram · met amandelspijs", retailPriceIncl: 15.95, image: christmasImages.stol },
  { id: "stol-klein", name: "Kleine kerststol", detail: "375 gram · met amandelspijs", retailPriceIncl: 7.5, image: christmasImages.stol },
  { id: "tulband", name: "Tulband", detail: "Een feestelijke klassieker", retailPriceIncl: 14.95, image: christmasImages.tulband },
  { id: "kerststaaf", name: "Kerststaaf", detail: "Gevuld met amandelspijs", retailPriceIncl: 8.95, image: christmasImages.amandel },
  { id: "kerstkrans", name: "Kerstkrans", detail: "Gevuld met amandelspijs", retailPriceIncl: 14.95, image: christmasImages.amandel },
  { id: "kruidcake", name: "Kerstkruidcake", detail: "Feestelijk versierd", retailPriceIncl: 7.95, image: christmasImages.cake },
  { id: "bonbons", name: "Bonbondoosje Fijne Feestdagen", detail: "16 stuks · in een luxe doosje", retailPriceIncl: 9.95, image: christmasImages.bonbons },
  { id: "krans-puur", name: "Chocoladekrans puur", detail: "Circa 200 gram · ook vegan mogelijk", retailPriceIncl: 13.95, image: christmasImages.chocolate, veganOption: true },
  { id: "kerstkoekjes", name: "Kerstkoekjes", detail: "Voor in jouw kerstpakket", retailPriceIncl: 6.95, image: christmasImages.cookies },
  { id: "schuimkransjes", name: "Schuimkransjes", detail: "Voor in jouw kerstpakket", retailPriceIncl: 4.95, image: christmasImages.meringues },
  { id: "kerstchocolade", name: "Kerstchocolade", detail: "Per 100 gram", retailPriceIncl: 6.95, image: christmasImages.christmasChocolate },
];

export const christmasHighlights: ChristmasHighlight[] = [
  { id: "stol", title: "Een echte kerstklassieker", description: "Onze kerststol met amandelspijs. Om samen van te genieten, in groot of klein formaat.", productIds: ["stol-groot", "stol-klein"], story: { src: "/Kerst/kerststol-zo-maken-we-hem.mp4", poster: "/Kerst/kerststol-maakvideo.jpg", description: "Zo maken we onze kerststollen in de bakkerij van Strik." } },
  { id: "tulband", title: "Feestelijk tot de laatste kruimel", description: "Een rijkgevulde tulband voor op de kersttafel. Een cadeau waar je graag voor aanschuift.", productIds: ["tulband"], story: { src: "/Kerst/tulband-zo-maken-we-hem.mp4", poster: "/Kerst/tulband-maakvideo.jpg", description: "Zo maken we onze tulbanden in de bakkerij van Strik." } },
  { id: "bonbons", title: "Fijne feestdagen in een doosje", description: "Zestien bonbons in een luxe doosje. Een feestelijk bedankje voor een collega of zakelijke relatie.", productIds: ["bonbons"], story: { src: "/Kerst/bonbons-zo-maken-we-ze.mp4", poster: "/Kerst/bonbons-maakvideo-portret.jpg", description: "Een kijkje bij het maken van onze bonbons in de chocolaterie van Strik." } },
];

export const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
export const money = (amount: number) => amount.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
export function quantity(value: number, minimum = 0, maximum = 9999) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.floor(value))) : minimum;
}
export function christmasTier(count: number) {
  return [...BUSINESS_FOLDER_PRICE_TIERS].reverse().find((tier) => count >= tier.min) || BUSINESS_FOLDER_PRICE_TIERS[0];
}
export function christmasUnitPrice(product: ChristmasProduct, count: number, includeVat: boolean) {
  return businessFolderRetailPrice(product.retailPriceIncl, christmasTier(count).discountPercent, includeVat);
}
export function christmasPackage(contents: Record<string, number>, count: number, includeVat: boolean) {
  const packageCount = quantity(count, 1);
  const lines = christmasProducts.flatMap((product) => {
    const amount = quantity(contents[product.id] || 0, 0, 99);
    if (!amount) return [];
    const unitPrice = christmasUnitPrice(product, packageCount, includeVat);
    return [{ product, quantity: amount, unitPrice, total: roundMoney(amount * unitPrice) }];
  });
  const perPackage = roundMoney(lines.reduce((sum, line) => sum + line.total, 0));
  return { lines, perPackage, total: roundMoney(perPackage * packageCount), count: packageCount, tier: christmasTier(packageCount) };
}
