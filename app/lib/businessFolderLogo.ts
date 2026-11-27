export const MAX_FOLDER_LOGO_SIZE = 4 * 1024 * 1024;
export type FolderLogoChoice = { method: "" | "upload" | "email"; file?: File; fileKey?: string };
export type UploadedFolderLogo = { name: string; size: number; sha256: string };

export function folderLogoError(required: boolean, choice: FolderLogoChoice): string {
  if (!required) return "";
  if (!choice.method) return "Kies of je het logo nu uploadt of later per mail nastuurt.";
  if (choice.method === "upload") {
    if (!choice.file?.size) return "Voeg je logobestand toe, of kies voor later per mail nasturen.";
    if (choice.file.size > MAX_FOLDER_LOGO_SIZE) return "Het logo is te groot. Kies een bestand van maximaal 4 MB, of stuur het later per mail.";
    if (!/\.(png|jpe?g|webp|pdf)$/i.test(choice.file.name)) return "Kies een PNG, JPG, WebP of PDF, of stuur het logo later per mail.";
  }
  return "";
}

export function folderLogoSummary(choice: FolderLogoChoice): string {
  if (choice.method === "email") return "Eigen logo · klant stuurt later per mail na.";
  if (choice.method === "upload") return choice.file ? `Eigen logo · bestand bij aanvraag: ${choice.file.name}` : "Eigen logo · bestand nog toevoegen.";
  return "Eigen logo · kies uploaden of later per mail nasturen.";
}
