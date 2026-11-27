"use client";

import { folderLogoError, type FolderLogoChoice } from "./lib/businessFolderLogo";
import { createQuoteRequestId } from "./lib/businessFolderSubmission";
import styles from "./BusinessFolderLogo.module.css";

export default function BusinessFolderLogo({ choice, onChange, disabled = false }: {
  choice: FolderLogoChoice;
  onChange: (choice: FolderLogoChoice) => void;
  disabled?: boolean;
}) {
  const fileError = choice.file ? folderLogoError(true, choice) : "";
  return <fieldset className={styles.panel} disabled={disabled}>
    <legend>Jullie logo aanleveren *</legend>
    <p>Je hebt een eigen logo gekozen. Hoe wil je het aanleveren?</p>
    <div className={styles.choices}>
      <label className={styles.option}>
        <input type="radio" name="logo-delivery" value="upload" required checked={choice.method === "upload"} onChange={() => onChange({ ...choice, method: "upload" })} />
        <span><strong>Nu uploaden</strong><small>Het logo gaat mee met je aanvraag.</small></span>
      </label>
      <label className={styles.option}>
        <input type="radio" name="logo-delivery" value="email" required checked={choice.method === "email"} onChange={() => onChange({ ...choice, method: "email" })} />
        <span><strong>Later per mail nasturen</strong><small>Je aanvraag kan alvast verder.</small></span>
      </label>
    </div>
    {choice.method === "upload" && <div className={styles.upload}>
      <label>Logobestand *
        <input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" aria-invalid={Boolean(fileError)} onChange={event => {
          const file = event.target.files?.[0];
          if (file) onChange({ method: "upload", file, fileKey: createQuoteRequestId() });
          event.target.value = "";
        }} />
      </label>
      <small>PNG, JPG, WebP of PDF · maximaal 4 MB. Liefst het originele bestand in hoge kwaliteit.</small>
      {choice.file && <p className={styles.file} aria-live="polite"><span>{choice.file.name}</span><button type="button" onClick={() => onChange({ method: "upload" })}>Verwijderen</button></p>}
      {fileError && <p role="alert" className={styles.error}>{fileError}</p>}
    </div>}
    {choice.method === "email" && <p className={styles.note}>Mail je logo naar <a href="mailto:info@strik-patisserie.nl">info@strik-patisserie.nl</a> met je bedrijfsnaam en de aanvraagreferentie die je na versturen krijgt. Voor productie hebben we het logo nodig.</p>}
  </fieldset>;
}
