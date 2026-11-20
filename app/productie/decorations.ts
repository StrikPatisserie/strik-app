import type { Ingredient } from "../bakkerij/recepturen/types";

/** Stable IDs survive changes to a descriptive code or a seasonal design. */
export function initialDecorations(): Ingredient[] {
  const definitions: {code:string;name:string;shape:string;size:string;color:string;pattern:string}[] = [];
  const add = (code:string,name:string,shape:string,size:string,color:string,pattern:string) => definitions.push({code,name,shape,size,color,pattern});
  add("01-RGKE", "Rond geel klein effen", "Rond", "Klein", "Geel", "Effen");
  add("02-VMGS", "Vierkant melk groot Strik", "Vierkant", "Groot", "Melk", "Strik");
  add("03-RWKS", "Rond wit Strik · Hazelino", "Rond", "", "Wit", "Strik");
  const colors = [["Melk","M"],["Puur","P"],["Wit","W"],["Oranje","O"],["Groen","GR"],["Rood-roze","RR"]];
  let index = 4;
  for (const [color,short] of colors) for (const [size,s] of [["Klein","K"],["Groot","G"]]) {
    if (color === "Melk" && size === "Groot") continue;
    add(`${String(index++).padStart(2,"0")}-V${short}${s}S`, `Vierkant ${color.toLowerCase()} ${size.toLowerCase()} Strik`, "Vierkant", size, color, "Strik");
  }
  for (const [color,short] of [...colors,["Geel","GE"]]) for (const [size,s] of [["Klein","K"],["Groot","G"]]) {
    if (color === "Geel" && size === "Klein") continue;
    add(`${String(index++).padStart(2,"0")}-R${short}${s}E`, `Rond ${color.toLowerCase()} ${size.toLowerCase()} effen`, "Rond", size, color, "Effen");
  }
  add(`${String(index++).padStart(2,"0")}-RST`, "Rond chocolaatje · Steventje", "Rond", "", "", "Steventje");
  for (const size of ["Klein","Groot"]) add(`${String(index++).padStart(2,"0")}-ZMG${size[0]}`, `Strik zegel melk goud brushed ${size.toLowerCase()}`, "Zegel", size, "Melk / goud", "Strik · brushed");
  add(`${String(index).padStart(2,"0")}-SZK`, "Seizoenszegel klein · variant invullen", "Zegel", "Klein", "", "Seizoen");
  return definitions.map(d => ({id:`deco-${d.code.split("-")[0]}`, name:`${d.code} · ${d.name}`, supplier:"Eigen productie", supplierArticleNumber:d.code, packageSize:"1 stuk", recipeUnit:"stuk", lastPrice:0, previousPrice:0, pricePerBaseUnit:0, allergens:[], lastUpdated:"2026-11-20", status:"active", lastInvoice:"", aliases:[d.name,d.code.split("-")[0]], decoration:{code:d.code,shape:d.shape,size:d.size,color:d.color,pattern:d.pattern,method:"homemade",materials:[],costKnown:false}}));
}

export function validateDecorations(ingredients: Ingredient[]) {
  const codes = new Set<string>(), ids = new Map(ingredients.map(i=>[i.id,i]));
  for (const item of ingredients) {
    const d = item.decoration;
    if (!d) continue;
    const text = (v:unknown,max=120):v is string => typeof v === "string" && v.length <= max;
    if (!text(d.code,40) || !/^[A-Z0-9-]+$/i.test(d.code) || codes.has(d.code.toUpperCase())) throw Error("Elke decoratie heeft een unieke code nodig.");
    codes.add(d.code.toUpperCase());
    if (!text(item.name,200) || !item.name.trim() || !text(d.shape) || !text(d.size) || !text(d.color) || !text(d.pattern) || !["homemade","purchased"].includes(d.method)) throw Error("Controleer de decoratiegegevens.");
    for (const value of [d.weightGrams,d.extraCostPerPiece,d.purchasePricePerPiece]) if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 10000)) throw Error("Gebruik geldige gewichten en prijzen voor de decoratie.");
    if (d.weightGrams === 0) throw Error("Vul een gewicht groter dan nul in, of laat het leeg.");
    if (!Array.isArray(d.materials) || d.materials.length > 30 || new Set(d.materials.map(m=>m.ingredientId)).size !== d.materials.length) throw Error("Controleer de grondstoffen van de decoratie.");
    for (const line of d.materials) {
      const raw = ids.get(line.ingredientId);
      if (!raw || raw.decoration || !["gram","kg"].includes(raw.recipeUnit) || !Number.isFinite(line.grams) || line.grams <= 0 || line.grams > 10000) throw Error("Kies een grondstof en vul grammen per decoratie in.");
    }
    if (d.photo !== undefined && (!text(d.photo,400000) || (d.photo && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.photo)))) throw Error("Kies een geldige, kleine decoratiefoto.");
  }
}
