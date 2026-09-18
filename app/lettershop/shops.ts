export const LETTERSHOP_SHOPS = [
  { id: "ziekerstraat", name: "Strik Centrum", address: "Ziekerstraat 124" },
  { id: "heyendaal", name: "Strik Brakkenstein", address: "Heyendaalseweg 217" },
  { id: "daalseweg", name: "Strik Nijmegen-Oost", address: "Daalseweg 254" },
  { id: "lent", name: "Strik Lent", address: "Oranje Marieplein 11" },
] as const;

export function lettershopShopLabel(id: string) {
  const shop = LETTERSHOP_SHOPS.find((item) => item.id === id);
  return shop ? `${shop.name} · ${shop.address}` : id;
}

// De WordPress-mailtemplate zet zelf al "Strik " voor de afhaallocatie.
export function lettershopMailLocation(id: string) {
  return lettershopShopLabel(id).replace(/^Strik /, "");
}
