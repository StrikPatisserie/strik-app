export type RolloutThickness = {
  id: string;
  product: string;
  thickness: string;
  note?: string;
  aliases?: readonly string[];
};

// Transcribed from the bakery's three rollout sheets, including handwritten additions.
// No unit is assumed: retain the original machine settings and approximations.
export const ROLLOUT_THICKNESSES: readonly RolloutThickness[] = [
  { id: "kaasbroodjes", product: "Kaasbroodjes", thickness: "2 en een beetje" },
  { id: "saucijzen", product: "Saucijzen", thickness: "2 en een beetje", aliases: ["saucijzenbroodje", "saucijzenbroodjes"] },
  { id: "worstenbroodje", product: "Worstenbroodje", thickness: "1,5", aliases: ["worstenbroodjes"] },
  { id: "amandelstaaf", product: "Amandelstaaf", thickness: "Iets meer dan 2", aliases: ["banketstaaf"] },
  { id: "speculaasstaaf", product: "Speculaasstaaf", thickness: "3", aliases: ["speculaas staaf"] },
  { id: "gevulde-koek", product: "Gevulde koek", thickness: "3" },
  { id: "appelmeisje", product: "Appelmeisje", thickness: "3,5", note: "Gaatjes prikken", aliases: ["appel meisje"] },
  { id: "gevuld-speculaas", product: "Gevuld speculaas", thickness: "4", aliases: ["gevulde speculaas"] },
  { id: "carre", product: "Carré", thickness: "2" },
  { id: "sloffen", product: "Sloffen", thickness: "9,5", aliases: ["slof"] },
  { id: "cheesecake", product: "Cheesecake (groot & klein)", thickness: "9,5", aliases: ["cheese groot klein", "cheese", "cheesem"] },
  { id: "speculaasbrok", product: "Speculaasbrok", thickness: "8,5", aliases: ["brok", "speculaas brok"] },
  { id: "petit-gateau", product: "Petit gateau", thickness: "7", aliases: ["gateaux", "gâteau", "gâteaux", "petit gâteau"] },
  { id: "krokante-vlaai", product: "Krokante vlaai", thickness: "Bijna 5", note: "Gaatjes in de aardbei" },
  { id: "tompouce", product: "Tompouce", thickness: "2", aliases: ["tompoes"] },
  { id: "mini-rondos", product: "Mini rondo’s", thickness: "6" },
  { id: "appel-noot-rondos", product: "Appel/noot rondo’s", thickness: "8,5", aliases: ["appelrondo", "notenrondo"] },
  { id: "gembermatjes-deeg", product: "Gembermatjes (sloffendeeg)", thickness: "6", aliases: ["gember matjes"] },
  { id: "gembermatjes-bovenkant", product: "Gembermatjes (bovenkant)", thickness: "3", note: "Appeltaartdeeg", aliases: ["gember matjes"] },
  { id: "theegebak", product: "Theegebak", thickness: "3,5", note: "HW-deeg", aliases: ["thee gebak", "hardewenerdeeg", "harde wener"] },
  { id: "kaasrondjes", product: "Kaasrondjes", thickness: "5", aliases: ["kaas rondjes"] },
  { id: "pitmop", product: "Pitmop", thickness: "5,5" },
  { id: "mozaiek", product: "Mozaïek", thickness: "4,5" },
  { id: "boterrondjes", product: "Boterrondjes", thickness: "4" },
  { id: "jan-hagel", product: "Jan hagel", thickness: "4" },
  { id: "appeltaart-randen", product: "Appeltaart (randen)", thickness: "3,5" },
  { id: "vlaaien", product: "Vlaaien", thickness: "5" },
  { id: "mini-appeltaartje", product: "Mini appeltaartje (bruce)", thickness: "7" },
  { id: "nijmeegsbrood", product: "Nijmeegsbrood", thickness: "5,5", aliases: ["Nijmeegs brood"] },
  { id: "pomme-lamour", product: "Pomme l’amour", thickness: "8", aliases: ["Pomme lamour", "Pomme l amour"] },
  { id: "amarenas", product: "Amarena’s (sloffendeeg)", thickness: "6", aliases: ["amarena"] },
  { id: "boterkoek", product: "Boterkoek", thickness: "22" },
  { id: "boterkoek-plaat", product: "Boterkoek (plaat)", thickness: "22" },
  { id: "gemberkoek", product: "Gemberkoek", thickness: "7" },
  { id: "brammetjes-bodem", product: "Brammetjes (bodem)", thickness: "3,5" },
  { id: "brammetjes-bovenkant", product: "Brammetjes (bovenkant)", thickness: "3,5" },
  { id: "sloffen-klein", product: "Sloffen klein", thickness: "8" },
  { id: "rondos", product: "Rondo’s", thickness: "7" },
].sort((a, b) => a.product.localeCompare(b.product, "nl-NL"));


export const ROLLOUT_THICKNESSES_KEY = "production_rollout_thicknesses_v1";
export type ThicknessDocument = { revision: number; rows: RolloutThickness[]; history: { action: string; product: string; who: string; at: string }[] };
export function initialThicknessDocument(): ThicknessDocument {
  return { revision: 0, rows: ROLLOUT_THICKNESSES.map(row => ({ ...row })), history: [] };
}
export function changeThickness(doc: ThicknessDocument, input: unknown, who: string, at: string): ThicknessDocument {
  if (!input || typeof input !== "object") throw Error("Controleer de uitroldikte.");
  const value = input as Record<string, unknown>;
  if (typeof value.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.id)) throw Error("Ongeldige uitroldikte.");
  const old = doc.rows.find(row => row.id === value.id);
  let rows: RolloutThickness[], product: string;
  if (value.action === "delete") {
    if (!old) throw Error("Deze uitroldikte bestaat niet meer.");
    product = old.product; rows = doc.rows.filter(row => row.id !== value.id);
  } else if (value.action === "save") {
    const field = (key: string, max: number, required = false) => {
      const text = typeof value[key] === "string" ? (value[key] as string).trim() : "";
      if ((required && !text) || text.length > max) throw Error("Vul product en dikte in; houd de tekst beknopt.");
      return text;
    };
    product = field("product", 160, true);
    const row: RolloutThickness = { id: value.id, product, thickness: field("thickness", 100, true), note: field("note", 500), ...(old?.aliases ? { aliases: old.aliases } : {}) };
    if (!old && doc.rows.length >= 1000) throw Error("Er staan al 1.000 uitroldiktes in de lijst.");
    rows = old ? doc.rows.map(item => item.id === row.id ? row : item) : [...doc.rows, row];
  } else throw Error("Ongeldige wijziging.");
  return { revision: doc.revision + 1, rows: rows.sort((a, b) => a.product.localeCompare(b.product, "nl-NL")), history: [...doc.history, { action: value.action, product, who, at }].slice(-1000) };
}
