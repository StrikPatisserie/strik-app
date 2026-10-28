import { addDays, type DemoRecipe, type Item, type PreviewState, type Task } from "../../productie/planning";

export const DEMO_TODAY = "2026-10-28";
export const DEMO_WEEK = "2026-10-26";
export const PREVIEW_STORAGE_KEY = "strik-production-preview-v1";

export const demoRecipes: DemoRecipe[] = [
  {id:"demo-creme",name:"Vanillecrème",type:"semiFinished",yield:5,unit:"kg",ingredients:[{name:"Voorbeeld room",quantity:5000,unit:"gram"}],steps:["Fictief voorbeeld: gebruik jullie eigen gevalideerde werkwijze."],allergens:["Melk"]},
  { id: "demo-kapsel", type:"semiFinished", name: "Vanillekapsel rond", yield: 20, unit: "stuks", ingredients: [{ name: "Heel ei", quantity: 2000, unit: "g" }, { name: "Kristalsuiker", quantity: 1000, unit: "g" }, { name: "Tarwebloem", quantity: 1000, unit: "g" }], steps: ["Weeg alle grondstoffen af en bereid het beslag volgens de werkinstructie.", "Verdeel over 20 vormen. Gebruik voor deze preview geen bereiding als productie-instructie.", "Laat volledig afkoelen en registreer de werkelijke opbrengst."], allergens: ["Ei", "Gluten"] },
  { id: "demo-fruit", type:"finalProduct", semiFinishedItems:[{recipeId:"demo-kapsel",quantity:12,unit:"stuks"},{recipeId:"demo-creme",quantity:2400,unit:"gram"}], name: "Fruitdesserttaart", yield: 12, unit: "stuks", ingredients: [{ name: "Taartbodem", quantity: 12, unit: "stuks" }, { name: "Vanillecrème", quantity: 2400, unit: "g" }, { name: "Vers fruit", quantity: 1800, unit: "g" }], steps: ["Controleer de beschikbare bodems en vulling.", "Vul en werk af met het fruit van de dag.", "Controleer aantal en afwerking vóór vrijgave."], allergens: ["Gluten", "Melk", "Ei"] },
  { id: "demo-slagroom", type:"finalProduct", name: "Slagroomtaart", yield: 10, unit: "stuks", ingredients: [{ name: "Kapsel", quantity: 10, unit: "stuks" }, { name: "Slagroom", quantity: 3000, unit: "g" }, { name: "Fruitvulling", quantity: 1000, unit: "g" }], steps: ["Leg kapsels en vulling klaar.", "Vul, maskeer en werk de taarten af.", "Controleer de bestelling en zet gekoeld klaar."], allergens: ["Gluten", "Melk", "Ei"] },
  { id: "demo-ganache", type:"semiFinished", name: "Chocoladeganache", yield: 5, unit: "kg", ingredients: [{ name: "Chocolade", quantity: 3000, unit: "g" }, { name: "Room", quantity: 2000, unit: "g" }], steps: ["Controleer de grondstoffen en batchhoeveelheid.", "Bereid de ganache en registreer de opbrengst."], allergens: ["Melk", "Soja"] },
];

export const demoIngredients = [
  { id: "g1", name: "Tarwebloem", supplier: "Voorbeeldleverancier", unit: "kg", linked: true, specification: "Leveranciersspecificatie gekoppeld", allergens: "Gluten" },
  { id: "g2", name: "Slagroom", supplier: "Voorbeeldleverancier", unit: "liter", linked: true, specification: "Leveranciersspecificatie gekoppeld", allergens: "Melk" },
  { id: "g3", name: "Chocolade puur", supplier: "Voorbeeldleverancier", unit: "kg", linked: false, specification: "Nog te koppelen", allergens: "Nog controleren" },
  { id: "g4", name: "Frambozenpuree", supplier: "Voorbeeldleverancier", unit: "kg", linked: true, specification: "Nieuwe versie ter beoordeling", allergens: "Nog controleren" },
  { id: "g5", name: "Heel ei", supplier: "Voorbeeldleverancier", unit: "kg", linked: false, specification: "Nog te koppelen", allergens: "Ei" },
];

export function initialPreviewState(): PreviewState {
  const items: Item[] = [
    {id:"creme",name:"Vanillecrème",kind:"component",departmentId:"dessert",unit:"kg",recipeId:"demo-creme",stock:0,note:"Fictief voorbeeld van een gekoppeld halffabricaat."},
    { id: "fruit", name: "Fruitdesserttaart", kind: "product", departmentId: "dessert", unit: "stuks", recipeId: "demo-fruit", articleNumber: "DEMO-01", stock: 6, minimumStock: 12, note: "Fruitkeuze afstemmen met de voorraad." },
    { id: "citroen", name: "Citroen-meringuetaart", kind: "product", departmentId: "dessert", unit: "stuks", stock: 8, minimumStock: 8, note: "Recept wordt later toegevoegd." },
    { id: "fruitbakjes", name: "Fruit voorbereiden", kind: "activity", departmentId: "dessert", unit: "taak", stock: 0, note: "Vers fruit wassen, controleren en snijden." },
    { id: "pistache", name: "Pistache petit gâteau", kind: "product", departmentId: "luxe", unit: "stuks", stock: 32, minimumStock: 48, note: "Afwerking met pistache en chocolade." },
    { id: "redvelvet", name: "Red velvet", kind: "product", departmentId: "luxe", unit: "stuks", stock: 24, minimumStock: 24, note: "" },
    { id: "ganache", name: "Chocoladeganache", kind: "component", departmentId: "luxe", unit: "kg", recipeId: "demo-ganache", stock: 2, minimumStock: 5, note: "Gedeeld onderdeel voor meerdere producten." },
    { id: "kapsels", name: "Vanillekapsels rond", kind: "component", departmentId: "kapsel", unit: "stuks", recipeId: "demo-kapsel", stock: 20, minimumStock: 40, note: "Een batch doorloopt bakken, afkoelen en klaarzetten." },
    { id: "confetti", name: "Confettitaart", kind: "product", departmentId: "kapsel", unit: "stuks", stock: 4, minimumStock: 8, note: "Persoonlijke foto's blijven aan de afzonderlijke orderregel gekoppeld." },
    { id: "slagroom", name: "Slagroomtaart", kind: "product", departmentId: "slagroom", unit: "stuks", recipeId: "demo-slagroom", stock: 8, minimumStock: 12, note: "" },
    { id: "tompouce", name: "Tompoucen", kind: "product", departmentId: "slagroom", unit: "stuks", stock: 36, minimumStock: 48, note: "" },
    { id: "bodems", name: "Sloffenbodems", kind: "component", departmentId: "bak", unit: "stuks", stock: 60, minimumStock: 100, note: "Ook selecteerbaar zonder uitgewerkt recept." },
    { id: "croissant", name: "Croissants", kind: "product", departmentId: "bak", unit: "stuks", stock: 0, note: "" },
    { id: "brood", name: "Desembrood", kind: "product", departmentId: "brood", unit: "stuks", stock: 12, minimumStock: 24, note: "" },
    { id: "ijs", name: "Vanille-ijs", kind: "product", departmentId: "ijs", unit: "liter", stock: 15, minimumStock: 20, note: "" },
    { id: "bonbon", name: "Bonbons gemengd", kind: "product", departmentId: "chocolade", unit: "stuks", stock: 120, minimumStock: 200, note: "" },
  ];
  const tasks: Task[] = [];
  const plan = (id: string, itemId: string, day: number, quantity: number, operation: string, minutes: number, extra: Partial<Task> = {}) => {
    const item = items.find(i => i.id === itemId)!;
    tasks.push({ id, itemId, departmentId: item.departmentId, date: addDays(DEMO_WEEK, day), quantity, operation, minutes, status: day < 2 ? "done" : "planned", note: "", source: "shop", batchId: `batch-${id}`, recordsOutput: item.kind !== "activity", ...extra });
  };
  plan("f1", "fruit", 0, 24, "Vullen & afwerken", 70);
  plan("f2", "citroen", 1, 18, "Afwerken", 45);
  plan("f3", "fruit", 2, 36, "Vullen & afwerken", 90, { status: "active" });
  plan("f4", "fruitbakjes", 2, 1, "Voorbereiden", 25, { status: "done", source: "routine" });
  plan("f5", "citroen", 3, 24, "Vullen", 60);
  plan("f6", "fruit", 4, 48, "Afwerken", 110, { source: "order", dueDate: "2026-10-30", note: "Voorbeeldbestelling · klaar vóór 10:00." });
  plan("f7", "fruit", 5, 24, "Vullen & afwerken", 60);
  plan("l1", "pistache", 0, 72, "Vullen", 90);
  plan("l2", "ganache", 1, 5, "Bereiden", 30);
  plan("l3", "redvelvet", 2, 48, "Afwerken", 60, { status: "active" });
  plan("l4", "pistache", 3, 96, "Vullen & afwerken", 120, { status: "blocked", note: "Pistachelevering nog controleren." });
  plan("l5", "ganache", 3, 5, "Bereiden", 30);
  plan("l6", "redvelvet", 4, 72, "Afwerken", 90);
  plan("l7", "pistache", 5, 48, "Afwerken", 60);
  plan("k1", "kapsels", 0, 60, "Bakken", 60, { batchId: "batch-kapsel-week44", recordsOutput: false });
  plan("k2", "kapsels", 1, 60, "Afkoelen & klaarzetten", 20, { batchId: "batch-kapsel-week44", dependsOn: "k1" });
  plan("k3", "confetti", 2, 12, "Vullen", 70);
  plan("k4", "kapsels", 3, 80, "Bakken", 75, { batchId: "batch-kapsel-do", recordsOutput: false, departmentId: "bak" });
  plan("k5", "kapsels", 4, 80, "Klaarzetten", 20, { batchId: "batch-kapsel-do", dependsOn: "k4" });
  plan("k6", "confetti", 5, 18, "Afwerken", 90, { source: "order" });
  plan("s1", "slagroom", 0, 20, "Vullen & afwerken", 60);
  plan("s2", "tompouce", 1, 96, "Vullen & snijden", 80);
  plan("s3", "slagroom", 2, 30, "Vullen", 75, { source: "order" });
  plan("s4", "tompouce", 3, 120, "Vullen & snijden", 100);
  plan("s5", "slagroom", 4, 40, "Vullen & afwerken", 110);
  plan("s6", "tompouce", 5, 96, "Vullen & snijden", 80);
  plan("b1", "bodems", 0, 100, "Bakken", 70);
  plan("b2", "croissant", 2, 160, "Bakken", 60, { status: "active" });
  plan("b3", "bodems", 4, 120, "Bakken", 80);
  for (let day = 0; day < 6; day++) plan(`br${day}`, "brood", day, day > 3 ? 80 : 48, "Kneden & bakken", 120);
  plan("i1", "ijs", 2, 30, "Draaien", 90);
  plan("i2", "ijs", 4, 20, "Draaien", 70);
  plan("c1", "bonbon", 1, 240, "Vullen & sluiten", 180);
  plan("c2", "bonbon", 3, 300, "Vullen & sluiten", 210);
  return { version: 1, items, tasks };
}
