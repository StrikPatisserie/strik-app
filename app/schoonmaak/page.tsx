"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
import { PlanType, Task, ijssalons, planOptions, getTakenLijst, flattenTasks } from "./tasks";
import {
  CleaningItem,
  CleaningPhotoUpload,
  CleaningTemperatureRegistration,
  createPhotoTemperatureRegistrations,
  getCleaningItemPhotos,
  getCleaningUrl,
  itemMatchesCleaningSelection,
  stripInternalCleaningTasks,
  stripInternalTemperatureRegistrations,
  withCleaningMetaMarkers,
} from "./cleaningApi";

type TemperatuurRegistratie = {
  id: string;
  naam: string;
  temperatuur: string;
};

type PhotoUpload = {
  id: string;
  label: string;
  fileName: string;
  previewUrl: string;
  dataUrl?: string;
  url?: string;
  mediaId?: number;
  file?: File;
};

type SchoonmaakAntwoorden = {
  planType: PlanType;
  naam: string;
  taken: string[];
  opmerking: string;
  temperatuurRegistraties: TemperatuurRegistratie[];
  fotoUploads: PhotoUpload[];
  verzondenSignatuur?: string;
};

function getVandaag() {
  const vandaag = new Date();
  const jaar = vandaag.getFullYear();
  const maand = String(vandaag.getMonth() + 1).padStart(2, "0");
  const dag = String(vandaag.getDate()).padStart(2, "0");

  return `${jaar}-${maand}-${dag}`;
}

function getDraftKey(winkel: string, datum: string, planType: PlanType) {
  return `strik-schoonmaak-${datum}-${winkel}-${planType}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Kan het bestand niet lezen."));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function maakJpegBestandsnaam(fileName: string) {
  const zonderExtensie = fileName.replace(/\.[^.]+$/, "");
  return `${zonderExtensie || "schoonmaak-foto"}.jpg`;
}

function verkleinFotoVoorUpload(file: File) {
  return new Promise<File>((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxSize = 700;
      const grootsteZijde = Math.max(image.width, image.height);
      const schaal = Math.min(1, maxSize / grootsteZijde);

      if (schaal === 1 && file.size < 1_800_000) {
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * schaal);
      canvas.height = Math.round(image.height * schaal);

      const context = canvas.getContext("2d");
      if (!context) {
        resolve(file);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          resolve(
            new File([blob], maakJpegBestandsnaam(file.name), {
              type: "image/jpeg",
            })
          );
        },
        "image/jpeg",
        0.45
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    image.src = objectUrl;
  });
}

const requiredFotoUploadLabels = [
  "Bovenkant ijsvitrine",
  "Keuken",
  "Vloer",
  "Spoelbakje",
] as const;

const vriezerControleTaakLabel =
  "Vriezers controleren op temperatuur en of ze goed dicht zijn!!";

const dagvoorraadVriezerPerIjssalon: Record<string, string> = {
  "ijsloket Daalseweg": "Enkele vrieskast dagvoorraad",
  "ijsloket Heyendaal": "Enkele vrieskast dagvoorraad",
  "ijsloket Ziekerstraat": "Dubbele vrieskast dagvoorraad",
  "ijsloket Lent": "Enkele vrieskast dagvoorraad",
};

function getVriezerTemperatuurVelden(winkel: string) {
  const vriezerNaam =
    dagvoorraadVriezerPerIjssalon[winkel] || "Vrieskast dagvoorraad";

  return [
    {
      id: `${vriezerNaam}-scherm`,
      naam: `${vriezerNaam} - schermtemperatuur`,
      vriezerNaam,
      label: "Schermtemperatuur",
      toelichting: "Wat geeft het digitale scherm op de vriezer aan?",
      placeholder: "Bijv. -18",
    },
    {
      id: `${vriezerNaam}-handmeter`,
      naam: `${vriezerNaam} - handmeting`,
      vriezerNaam,
      label: "Handmeting",
      toelichting: "Meet de werkelijke temperatuur met het handmetertje.",
      placeholder: "Bijv. -19",
    },
  ];
}

function maakTemperatuurId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function normaliseerTemperatuurRegistraties(
  itemId: number,
  registraties: CleaningTemperatureRegistration[] = []
): TemperatuurRegistratie[] {
  return stripInternalTemperatureRegistrations(registraties).map(
    (item, index) => ({
      id: item.id || `${itemId}-temperatuur-${index}`,
      naam: item.naam || "",
      temperatuur: item.temperatuur || "",
    })
  );
}

function normaliseerFotoUploads(
  itemId: number,
  uploads: CleaningPhotoUpload[] = []
): PhotoUpload[] {
  return uploads.map((upload, index) => ({
    id: upload.id || `${itemId}-foto-${index}`,
    label: upload.label,
    fileName: upload.fileName,
    previewUrl: upload.url || upload.dataUrl || "",
    dataUrl: upload.dataUrl,
    url: upload.url,
    mediaId: upload.mediaId,
  }));
}

function getFotoSrc(upload: PhotoUpload | CleaningPhotoUpload) {
  return (
    upload.url ||
    upload.dataUrl ||
    ("previewUrl" in upload ? upload.previewUrl : "")
  );
}

function maakSignatuur(antwoorden: SchoonmaakAntwoorden) {
  return JSON.stringify({
    planType: antwoorden.planType,
    naam: antwoorden.naam.trim(),
    taken: antwoorden.taken,
    opmerking: antwoorden.opmerking.trim(),
    temperatuurRegistraties: antwoorden.temperatuurRegistraties
      .filter((item) => item.naam.trim() && item.temperatuur.trim())
      .map((item) => ({
        naam: item.naam.trim(),
        temperatuur: item.temperatuur.trim(),
      })),
    fotoUploads: antwoorden.fotoUploads.map((upload) => ({
      label: upload.label,
      fileName: upload.fileName,
      url: upload.url,
      mediaId: upload.mediaId,
    })),
  });
}

function SchoonmaakForm() {
  const searchParams = useSearchParams();
  const planQuery = searchParams.get("plan");
  const defaultPlanType: PlanType =
    planQuery === "afsluit" ? "Afsluitplan" : "Opstartplan";

  const [gekozenPlanType, setGekozenPlanType] = useState<PlanType | null>(null);
  const planType = gekozenPlanType ?? defaultPlanType;
  const [winkel, setWinkel] = useState("ijsloket Lent");
  const [datum, setDatum] = useState(getVandaag);
  const [naam, setNaam] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [opmerking, setOpmerking] = useState("");
  const [temperatuurRegistraties, setTemperatuurRegistraties] = useState<
    TemperatuurRegistratie[]
  >([]);
  const [verzondenSignatuur, setVerzondenSignatuur] = useState("");
  const [status, setStatus] = useState("");
  const [ladenBezig, setLadenBezig] = useState(false);
  const [verzendenBezig, setVerzendenBezig] = useState(false);
  const [activeInfo, setActiveInfo] = useState<
    | { title: string; description: string }
    | null
  >(null);
  const [fotoUploads, setFotoUploads] = useState<PhotoUpload[]>([]);

  const takenLijst = useMemo(
    () => getTakenLijst(planType, winkel),
    [planType, winkel]
  );

  const taskItems = useMemo(() => flattenTasks(takenLijst), [takenLijst]);

  const taskLabelById = useMemo(
    () => Object.fromEntries(taskItems.map((task) => [task.id, task.label])),
    [taskItems]
  );

  const taskIdByLabel = useMemo(
    () => Object.fromEntries(taskItems.map((task) => [task.label, task.id])),
    [taskItems]
  );

  const temperatuurRegistratieActief = taken
    .map((id) => taskLabelById[id] ?? id)
    .includes("Temperatuur registratie");

  const vriezerTemperatuurVelden = useMemo(
    () =>
      planType === "Afsluitplan" ? getVriezerTemperatuurVelden(winkel) : [],
    [planType, winkel]
  );

  function getTemperatuurWaarde(naam: string) {
    return (
      temperatuurRegistraties.find((item) => item.naam === naam)
        ?.temperatuur ?? ""
    );
  }

  const vriezerControleTaakGevinkt = Boolean(
    taskIdByLabel[vriezerControleTaakLabel] &&
      taken.includes(taskIdByLabel[vriezerControleTaakLabel])
  );

  const heeftVriezerTemperatuurInvoer = vriezerTemperatuurVelden.some((veld) =>
    getTemperatuurWaarde(veld.naam).trim()
  );

  const ontbrekendeVriezerTemperaturen = vriezerTemperatuurVelden.filter(
    (veld) => !getTemperatuurWaarde(veld.naam).trim()
  );

  useEffect(() => {
    let negeerResultaat = false;

    async function laadAntwoorden() {
      setLadenBezig(true);
      setStatus("");

      try {
        const res = await fetch(getCleaningUrl(), { cache: "no-store" });
        const items = (await res.json()) as CleaningItem[];

        if (!res.ok || negeerResultaat) return;

        const opgeslagenItems = items
          .filter((item) =>
            itemMatchesCleaningSelection(item, winkel, datum, planType)
          )
          .sort((a, b) => b.id - a.id);

        const nieuwsteItem = opgeslagenItems[0];
        const zichtbareTaken = stripInternalCleaningTasks(
          nieuwsteItem?.taken || []
        );

        const geladenTaken = zichtbareTaken.map(
          (taak) => taskIdByLabel[taak] ?? taak
        );

        setTaken(geladenTaken);
        setNaam(nieuwsteItem?.naam || "");
        setOpmerking(nieuwsteItem?.opmerking || "");
        setTemperatuurRegistraties(
          nieuwsteItem
            ? normaliseerTemperatuurRegistraties(
                nieuwsteItem.id,
                nieuwsteItem.temperatuurRegistraties
              )
            : []
        );
        setFotoUploads(
          nieuwsteItem
            ? normaliseerFotoUploads(
                nieuwsteItem.id,
                getCleaningItemPhotos(nieuwsteItem)
              )
            : []
        );
        setVerzondenSignatuur(
          nieuwsteItem
            ? maakSignatuur({
                planType,
                naam: nieuwsteItem.naam || "",
                taken: zichtbareTaken,
                opmerking: nieuwsteItem.opmerking || "",
                temperatuurRegistraties: normaliseerTemperatuurRegistraties(
                  nieuwsteItem.id,
                  nieuwsteItem.temperatuurRegistraties
                ),
                fotoUploads: normaliseerFotoUploads(
                  nieuwsteItem.id,
                  getCleaningItemPhotos(nieuwsteItem)
                ),
              })
            : ""
        );

        if (opgeslagenItems.length > 0) {
          setStatus("Opgeslagen antwoorden geladen.");
        }
      } catch {
        if (!negeerResultaat) {
          setStatus("Eerdere antwoorden konden niet geladen worden.");
        }
      } finally {
        if (!negeerResultaat) {
          setLadenBezig(false);
        }
      }
    }

    laadAntwoorden();

    return () => {
      negeerResultaat = true;
    };
  }, [winkel, datum, planType, taskIdByLabel]);

  function isComplete(task: Task): boolean {
    if (!task.children) {
      return taken.includes(task.id);
    }

    return task.children.every(isComplete);
  }

  function toggleTaak(taak: Task) {
    if (taak.children) {
      const alleGevinkt = taak.children.every(isComplete);
      const volgendeTaken = new Set(taken);

      taak.children.forEach((kind) => {
        if (alleGevinkt) {
          volgendeTaken.delete(kind.id);
        } else {
          volgendeTaken.add(kind.id);
        }
      });

      setTaken(Array.from(volgendeTaken));
      return;
    }

    setTaken((prev) =>
      prev.includes(taak.id)
        ? prev.filter((t) => t !== taak.id)
        : [...prev, taak.id]
    );
  }

  function getAntwoorden(
    volgendeFotoUploads: PhotoUpload[] = fotoUploads
  ): SchoonmaakAntwoorden {
    return {
      planType,
      naam,
      taken: taken.map((id) => taskLabelById[id] ?? id),
      opmerking,
      temperatuurRegistraties,
      fotoUploads: volgendeFotoUploads,
      verzondenSignatuur,
    };
  }

  function voegTemperatuurRegistratieToe() {
    setTemperatuurRegistraties((prev) => [
      ...prev,
      { id: maakTemperatuurId(), naam: "", temperatuur: "" },
    ]);
  }

  function updateTemperatuurRegistratie(
    id: string,
    veld: "naam" | "temperatuur",
    waarde: string
  ) {
    setTemperatuurRegistraties((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [veld]: waarde } : item))
    );
  }

  function updateVriezerTemperatuur(naam: string, waarde: string) {
    setTemperatuurRegistraties((prev) => {
      const bestaat = prev.some((item) => item.naam === naam);

      if (!bestaat) {
        return [
          ...prev,
          { id: maakTemperatuurId(), naam, temperatuur: waarde },
        ];
      }

      return prev.map((item) =>
        item.naam === naam ? { ...item, temperatuur: waarde } : item
      );
    });
  }

  function verwijderTemperatuurRegistratie(id: string) {
    setTemperatuurRegistraties((prev) => prev.filter((item) => item.id !== id));
  }

  async function updateFotoUpload(label: string, file: File | null) {
    if (!file) return;

    setStatus(`Foto voorbereiden: ${label}...`);

    let volgendeUploads: PhotoUpload[];

    try {
      const uploadFile = await verkleinFotoVoorUpload(file);
      const previewUrl = await readFileAsDataUrl(uploadFile);
      volgendeUploads = [
        ...fotoUploads.filter((upload) => upload.label !== label),
        {
          id: `${label}-${Date.now()}`,
          label,
          fileName: uploadFile.name,
          previewUrl,
          dataUrl: previewUrl,
          file: uploadFile,
        },
      ];
    } catch {
      setStatus("Foto kon niet gelezen worden.");
      return;
    }

    setFotoUploads(volgendeUploads);
    setStatus("Foto opslaan...");
    await submitAntwoorden(volgendeUploads);
  }

  function verwijderFotoUpload(label: string) {
    setFotoUploads((prev) => prev.filter((upload) => upload.label !== label));
  }

  async function uploadFotoNaarWordPress(upload: PhotoUpload) {
    if (upload.url || !upload.file) return upload;

    const formData = new FormData();
    formData.set("file", upload.file, upload.file.name);
    formData.set("label", upload.label);
    formData.set("winkel", winkel);
    formData.set("datum", datum);
    formData.set("planType", planType);

    const res = await fetch("/api/cleaning-photo", {
      method: "POST",
      body: formData,
    });

    const data = (await res.json().catch(() => null)) as {
      id?: number;
      url?: string;
      fileName?: string;
      message?: string;
    } | null;

    if (res.status === 503 && upload.dataUrl) {
      return upload;
    }

    if (!res.ok || !data?.url) {
      throw new Error(data?.message || "Foto uploaden naar WordPress mislukt.");
    }

    return {
      ...upload,
      file: undefined,
      dataUrl: undefined,
      previewUrl: data.url,
      url: data.url,
      mediaId: data.id,
      fileName: data.fileName || upload.fileName,
    };
  }

  async function uploadNieuweFotos(uploads: PhotoUpload[]) {
    const volgendeUploads: PhotoUpload[] = [];

    for (const upload of uploads) {
      if (upload.file && !upload.url) {
        setStatus(`Foto uploaden: ${upload.label}...`);
      }

      volgendeUploads.push(await uploadFotoNaarWordPress(upload));
    }

    return volgendeUploads;
  }

  function serialiseerFotoUpload(upload: PhotoUpload): CleaningPhotoUpload {
    return {
      label: upload.label,
      fileName: upload.fileName,
      url: upload.url,
      mediaId: upload.mediaId,
      dataUrl: upload.url ? undefined : upload.dataUrl,
    };
  }

  function valideerAntwoorden(volgendeFotoUploads: PhotoUpload[] = fotoUploads) {
    const heeftTemperatuur = temperatuurRegistraties.some(
      (item) => item.naam.trim() || item.temperatuur.trim()
    );
    const heeftInhoud =
      naam.trim() ||
      taken.length > 0 ||
      opmerking.trim() ||
      heeftTemperatuur ||
      volgendeFotoUploads.length > 0;

    if (!heeftInhoud) {
      setStatus("Vul eerst iets in om op te slaan.");
      return false;
    }

    if (
      planType === "Afsluitplan" &&
      (vriezerControleTaakGevinkt || heeftVriezerTemperatuurInvoer) &&
      ontbrekendeVriezerTemperaturen.length > 0
    ) {
      setStatus(
        "Vul bij de dagvoorraad-vriezer zowel de schermtemperatuur als de handmeting in."
      );
      return false;
    }

    return true;
  }

  async function submitAntwoorden(
    volgendeFotoUploads: PhotoUpload[] = fotoUploads
  ) {
    if (!valideerAntwoorden(volgendeFotoUploads)) return;

    setStatus("Opslaan...");
    setVerzendenBezig(true);

    let timeoutId: number | undefined;

    try {
      const fotoUploadsVoorOpslaan = await uploadNieuweFotos(
        volgendeFotoUploads
      );
      setFotoUploads(fotoUploadsVoorOpslaan);

      const antwoorden = getAntwoorden(fotoUploadsVoorOpslaan);
      const signatuur = maakSignatuur(antwoorden);
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 12_000);

      const res = await fetch(getCleaningUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titel: planType,
          winkel,
          naam: naam.trim(),
          datum,
          taken: withCleaningMetaMarkers(
            antwoorden.taken,
            planType,
            fotoUploadsVoorOpslaan
          ),
          opmerking: opmerking.trim(),
          temperatuurRegistraties: [
            ...temperatuurRegistraties
              .filter((item) => item.naam.trim() && item.temperatuur.trim())
              .map((item) => ({
                naam: item.naam.trim(),
                temperatuur: item.temperatuur.trim(),
              })),
            ...createPhotoTemperatureRegistrations(fotoUploadsVoorOpslaan),
          ],
          fotoUploads: fotoUploadsVoorOpslaan.map(serialiseerFotoUpload),
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (res.ok) {
        setVerzondenSignatuur(signatuur);
        localStorage.setItem(
          getDraftKey(winkel, datum, planType),
          JSON.stringify({ ...antwoorden, verzondenSignatuur: signatuur })
        );
        setStatus("Opgeslagen en verzonden.");
        return;
      }

      if (res.status === 403) {
        setStatus("Geen toegang vanuit WordPress. Controleer de API sleutel.");
        return;
      }

      setStatus(data?.message || "Opslaan mislukt.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("WordPress reageert niet. Probeer opnieuw.");
        return;
      }

      setStatus(
        error instanceof Error
          ? error.message
          : "Kan geen verbinding maken met WordPress."
      );
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      setVerzendenBezig(false);
    }
  }

  function opslaan() {
    void verzenden();
  }

  async function verzenden() {
    await submitAntwoorden();
  }

  return (
    <StrikShell>
        <StrikPageHeader
          title={planType}
          description={`Dagelijkse ${planType === "Opstartplan" ? "opstart" : "afsluit"} checklist per ijssalon.`}
          icon={strikIcons.cleaning}
          tone="medium"
        />

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {planOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGekozenPlanType(option.value)}
                className={`rounded-2xl border p-4 text-sm font-semibold transition ${
                  planType === option.value
                    ? "border-[#93b28b] bg-[#c3d3bc]"
                    : "border-[#e7e0d8] bg-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          <select
            value={winkel}
            onChange={(e) => setWinkel(e.target.value)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          >
            {ijssalons.map((ijssalon) => (
              <option key={ijssalon}>{ijssalon}</option>
            ))}
          </select>

          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Naam medewerker"
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          {planType === "Afsluitplan" && (
            <div className="rounded-3xl bg-[#f7faf5] p-4 text-sm text-gray-700 shadow-sm">
              <p className="font-semibold">Afsluitplan</p>
              <p className="mt-2">
                Bij sommige afsluitstappen staat extra uitleg onder het info-icoon.
              </p>
            </div>
          )}

          <div className="rounded-3xl bg-white/85 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-bold">Taken</p>
              {ladenBezig && (
                <span className="text-xs font-semibold text-gray-500">
                  Laden...
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {takenLijst.map((taak) => (
                <div
                  key={taak.id}
                  className="space-y-2 rounded-2xl border border-[#d6e2cf] bg-white p-2 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleTaak(taak)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left text-base font-bold leading-tight shadow-sm transition active:scale-[0.99] ${
                      isComplete(taak)
                        ? "border-[#8fb184] bg-[#c3d3bc] text-[#243620]"
                        : "border-[#b8ccb0] bg-[#dce8d6] text-[#2d3f29]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{isComplete(taak) ? "✓ " : ""}{taak.label}</span>
                      {taak.info && (
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveInfo({ title: taak.label, description: taak.info! });
                          }}
                          className="cursor-pointer rounded-full border border-[#d8d6cc] bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-[#3b6b43]"
                        >
                          i
                        </span>
                      )}
                    </div>
                  </button>

                  {taak.children && (
                    <div className="space-y-1.5 rounded-2xl bg-[#f8f6f3] p-2">
                      {taak.children.map((subtaak) => (
                        <div key={subtaak.id} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleTaak(subtaak)}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-normal leading-snug transition active:scale-[0.99] ${
                              taken.includes(subtaak.id)
                                ? "border-[#b8ccb0] bg-[#eef3ea] text-[#243620]"
                                : "border-[#e7e0d8] bg-white text-[#4f554c]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span>{taken.includes(subtaak.id) ? "✓ " : ""}{subtaak.label}</span>
                              {subtaak.info && (
                                <span
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActiveInfo({ title: subtaak.label, description: subtaak.info! });
                                  }}
                                  className="cursor-pointer rounded-full border border-[#d8d6cc] bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-[#3b6b43]"
                                >
                                  i
                                </span>
                              )}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {planType === "Afsluitplan" && vriezerTemperatuurVelden.length > 0 && (
            <section className="rounded-3xl bg-white/85 p-4 shadow-sm">
              <div className="mb-3">
                <p className="font-bold">Vriezertemperaturen</p>
                <p className="mt-1 text-sm text-gray-600">
                  Noteer wat het digitale scherm aangeeft en meet daarna met het
                  handmetertje of dit klopt.
                </p>
              </div>

              <div className="rounded-3xl border border-[#e7e0d8] bg-[#f8f6f3] p-4">
                <p className="text-sm font-bold text-[#2d2a26]">
                  {vriezerTemperatuurVelden[0]?.vriezerNaam}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {vriezerTemperatuurVelden.map((veld) => {
                    const waarde = getTemperatuurWaarde(veld.naam);
                    const ontbreekt =
                      (vriezerControleTaakGevinkt ||
                        heeftVriezerTemperatuurInvoer) &&
                      !waarde.trim();

                    return (
                      <label
                        key={veld.id}
                        className={`block rounded-2xl border p-3 ${
                          ontbreekt
                            ? "border-[#d75a48] bg-[#fff7f5]"
                            : "border-[#e7e0d8] bg-white"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-[#2d2a26]">
                          {veld.label}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-gray-500">
                          {veld.toelichting}
                        </span>
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            value={waarde}
                            onChange={(e) =>
                              updateVriezerTemperatuur(
                                veld.naam,
                                e.target.value
                              )
                            }
                            placeholder={veld.placeholder}
                            inputMode="decimal"
                            className="min-w-0 flex-1 rounded-xl border border-[#e7e0d8] bg-white p-3"
                          />
                          <span className="text-sm font-bold text-gray-500">
                            °C
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          <textarea
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
            placeholder="Opmerking"
            className="min-h-28 w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          {planType === "Afsluitplan" && (
            <section className="rounded-3xl bg-white/85 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">Verplichte fotos</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Upload een foto voor elke verplichte locatie voordat je verzendt.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {requiredFotoUploadLabels.map((label) => {
                  const upload = fotoUploads.find((item) => item.label === label);
                  const fotoSrc = upload ? getFotoSrc(upload) : "";

                  return (
                    <div
                      key={label}
                      className="rounded-3xl border border-[#e7e0d8] bg-[#f8f6f3] p-4"
                    >
                      <p className="mb-2 text-sm font-semibold">{label}</p>
                      <input
                        id={`foto-upload-${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          updateFotoUpload(label, e.target.files?.[0] ?? null)
                        }
                        className="sr-only"
                      />
                      <label
                        htmlFor={`foto-upload-${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
                        className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#9fb891] bg-[#eff7ee] px-4 py-3 text-sm font-semibold text-[#3b6b43] transition hover:bg-[#e3f0e0] cursor-pointer"
                      >
                        <img src={strikIcons.photo} alt="Foto" className="h-5 w-5" />
                        {upload ? "Vervang foto" : "Upload foto"}
                      </label>
                      {upload ? (
                        <div className="space-y-2">
                          {fotoSrc && (
                            <img
                              src={fotoSrc}
                              alt={upload.fileName}
                              className="h-28 w-full rounded-2xl object-cover"
                            />
                          )}
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-[#2d2a26]">
                              {upload.fileName}
                            </span>
                            <button
                              type="button"
                              onClick={() => verwijderFotoUpload(label)}
                              className="rounded-full bg-white px-3 py-1 text-[#d75a48]"
                            >
                              Verwijder
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Selecteer een foto van {label.toLowerCase()}.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {temperatuurRegistratieActief && (
            <section className="rounded-3xl bg-white/85 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">Temperatuur registratie</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Voeg elke koeling of vriezer toe met temperatuur.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {temperatuurRegistraties.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-3"
                  >
                    <input
                      value={item.naam}
                      onChange={(e) =>
                        updateTemperatuurRegistratie(item.id, "naam", e.target.value)
                      }
                      placeholder="Bijv. Opslag vriezer"
                      className="mb-2 w-full rounded-xl border border-[#e7e0d8] bg-white p-3"
                    />
                    <div className="flex gap-2">
                      <input
                        value={item.temperatuur}
                        onChange={(e) =>
                          updateTemperatuurRegistratie(
                            item.id,
                            "temperatuur",
                            e.target.value
                          )
                        }
                        placeholder="Temperatuur"
                        inputMode="decimal"
                        className="min-w-0 flex-1 rounded-xl border border-[#e7e0d8] bg-white p-3"
                      />
                      <button
                        type="button"
                        onClick={() => verwijderTemperatuurRegistratie(item.id)}
                        className="rounded-xl bg-white px-4 text-sm font-bold text-[#d75a48]"
                      >
                        Wis
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={voegTemperatuurRegistratieToe}
                  className="w-full rounded-2xl border border-dashed border-[#c3d3bc] bg-[#c3d3bc]/20 p-4 text-sm font-bold"
                >
                  Koeling toevoegen
                </button>
              </div>
            </section>
          )}

          <button
            onClick={opslaan}
            disabled={verzendenBezig}
            className="w-full rounded-full bg-[#c3d3bc] p-4 font-bold text-[#2d2a26] shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            {verzendenBezig ? "Opslaan..." : "Opslaan"}
          </button>

          {status && (
            <p className="rounded-2xl bg-white p-3 text-center text-sm shadow-sm">
              {status}
            </p>
          )}

          {activeInfo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
              <div className="max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2d2a26]/60">
                      Info
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-[#2d2a26]">
                      {activeInfo.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveInfo(null)}
                    className="rounded-full bg-[#f3f2ee] px-3 py-2 text-sm font-bold text-[#2d2a26]"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-[#4b5d47]">
                  {activeInfo.description}
                </p>
              </div>
            </div>
          )}
        </div>
    </StrikShell>
  );
}

export default function SchoonmaakPage() {
  return (
    <Suspense fallback={<div className="p-5 text-center text-gray-500">Laden...</div>}>
      <SchoonmaakForm />
    </Suspense>
  );
}
