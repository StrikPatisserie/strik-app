"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
import {
  PlanType,
  Task,
  afsluitPhaseOrder,
  ijssalons,
  planOptions,
  getTakenLijst,
  flattenTasks,
  getTaskLabelAliases,
} from "./tasks";
import {
  CleaningPhotoUpload,
  CleaningTemperatureRegistration,
  createPhotoTemperatureRegistrations,
  fetchCleaningItems,
  getCleaningItemPhotos,
  itemMatchesCleaningSelection,
  saveCleaningItem,
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

type AntwoordOverrides = {
  takenIds?: string[];
  naam?: string;
  opmerking?: string;
  temperatuurRegistraties?: TemperatuurRegistratie[];
};

type SubmitOptions = AntwoordOverrides & {
  allowPartial?: boolean;
  silent?: boolean;
  skipIfUnchanged?: boolean;
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

const FOTO_UPLOAD_MAX_ZIJDE = 520;
const FOTO_UPLOAD_MIN_ZIJDE = 320;
const FOTO_UPLOAD_DOEL_BYTES = 180_000;
const FOTO_UPLOAD_KWALITEITEN = [0.38, 0.3, 0.24];

function canvasNaarJpegBlob(canvas: HTMLCanvasElement, kwaliteit: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", kwaliteit);
  });
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

      void (async () => {
        try {
          const grootsteZijde = Math.max(image.width, image.height);
          let maxZijde = FOTO_UPLOAD_MAX_ZIJDE;
          let besteBlob: Blob | null = null;

          while (maxZijde >= FOTO_UPLOAD_MIN_ZIJDE) {
            const schaal = Math.min(1, maxZijde / grootsteZijde);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.width * schaal));
            canvas.height = Math.max(1, Math.round(image.height * schaal));

            const context = canvas.getContext("2d");
            if (!context) {
              resolve(file);
              return;
            }

            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            for (const kwaliteit of FOTO_UPLOAD_KWALITEITEN) {
              const blob = await canvasNaarJpegBlob(canvas, kwaliteit);
              if (!blob) continue;

              besteBlob = blob;

              if (blob.size <= FOTO_UPLOAD_DOEL_BYTES) {
                resolve(
                  new File([blob], maakJpegBestandsnaam(file.name), {
                    type: "image/jpeg",
                  })
                );
                return;
              }
            }

            maxZijde = Math.round(maxZijde * 0.82);
          }

          if (besteBlob) {
            resolve(
              new File([besteBlob], maakJpegBestandsnaam(file.name), {
                type: "image/jpeg",
              })
            );
            return;
          }

          resolve(file);
        } catch {
          resolve(file);
        }
      })();
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

function isTemperatuurWaardeIngevuld(waarde: string) {
  const temperatuur = waarde.trim();

  return Boolean(temperatuur && temperatuur !== "-" && temperatuur !== "−");
}

function standaardTemperatuurWaarde(waarde = "") {
  return waarde.trim() ? waarde : "-";
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
      .filter(
        (item) => item.naam.trim() && isTemperatuurWaardeIngevuld(item.temperatuur)
      )
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

function maakLokaleDraft(
  antwoorden: SchoonmaakAntwoorden,
  verzondenSignatuur: string
): SchoonmaakAntwoorden {
  return {
    ...antwoorden,
    fotoUploads: antwoorden.fotoUploads.map((upload) => ({
      id: upload.id,
      label: upload.label,
      fileName: upload.fileName,
      previewUrl: upload.previewUrl,
      dataUrl: upload.dataUrl,
      url: upload.url,
      mediaId: upload.mediaId,
    })),
    verzondenSignatuur,
  };
}

function bewaarLokaleDraft(
  winkel: string,
  datum: string,
  planType: PlanType,
  antwoorden: SchoonmaakAntwoorden,
  verzondenSignatuur: string
) {
  try {
    localStorage.setItem(
      getDraftKey(winkel, datum, planType),
      JSON.stringify(maakLokaleDraft(antwoorden, verzondenSignatuur))
    );
  } catch {
    // Als lokale opslag vol of geblokkeerd is, mag opslaan naar WordPress doorgaan.
  }
}

function leesLokaleDraft(
  winkel: string,
  datum: string,
  planType: PlanType
): SchoonmaakAntwoorden | null {
  try {
    const raw = localStorage.getItem(getDraftKey(winkel, datum, planType));
    if (!raw) return null;

    const data = JSON.parse(raw) as Partial<SchoonmaakAntwoorden>;

    return {
      planType,
      naam: typeof data.naam === "string" ? data.naam : "",
      taken: Array.isArray(data.taken) ? data.taken : [],
      opmerking: typeof data.opmerking === "string" ? data.opmerking : "",
      temperatuurRegistraties: Array.isArray(data.temperatuurRegistraties)
        ? data.temperatuurRegistraties
        : [],
      fotoUploads: Array.isArray(data.fotoUploads) ? data.fotoUploads : [],
      verzondenSignatuur:
        typeof data.verzondenSignatuur === "string"
          ? data.verzondenSignatuur
          : undefined,
    };
  } catch {
    return null;
  }
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
  const autoSaveTimerRef = useRef<number | null>(null);
  const verzondenSignatuurRef = useRef("");
  const photoUploadIdRef = useRef(0);

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
    () => {
      const entries: Array<[string, string]> = [];

      taskItems.forEach((task) => {
        getTaskLabelAliases(task).forEach((label) => {
          entries.push([label, task.id]);
        });
      });

      return Object.fromEntries(entries);
    },
    [taskItems]
  );

  const afsluitTakenPerFase = useMemo(
    () =>
      planType === "Afsluitplan"
        ? afsluitPhaseOrder
            .map((phase) => ({
              phase,
              tasks: takenLijst.filter((taak) => taak.phase === phase),
            }))
            .filter((group) => group.tasks.length > 0)
        : [],
    [planType, takenLijst]
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
    return standaardTemperatuurWaarde(
      temperatuurRegistraties.find((item) => item.naam === naam)?.temperatuur
    );
  }

  const vriezerControleTaakGevinkt = Boolean(
    taskIdByLabel[vriezerControleTaakLabel] &&
      taken.includes(taskIdByLabel[vriezerControleTaakLabel])
  );

  const heeftVriezerTemperatuurInvoer = vriezerTemperatuurVelden.some((veld) =>
    isTemperatuurWaardeIngevuld(getTemperatuurWaarde(veld.naam))
  );

  const ontbrekendeVriezerTemperaturen = vriezerTemperatuurVelden.filter(
    (veld) => !isTemperatuurWaardeIngevuld(getTemperatuurWaarde(veld.naam))
  );

  useEffect(() => {
    verzondenSignatuurRef.current = verzondenSignatuur;
  }, [verzondenSignatuur]);

  useEffect(
    () => () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    let negeerResultaat = false;

    async function laadAntwoorden() {
      setLadenBezig(true);
      setStatus("");

      function laadLokaleDraftAlsFallback(statusBericht: string) {
        const lokaleDraft = leesLokaleDraft(winkel, datum, planType);
        if (!lokaleDraft) return false;

        const lokaleTaken = lokaleDraft.taken.map(
          (taak) => taskIdByLabel[taak] ?? taak
        );
        const signatuur = lokaleDraft.verzondenSignatuur || maakSignatuur(lokaleDraft);

        setTaken(lokaleTaken);
        setNaam(lokaleDraft.naam || "");
        setOpmerking(lokaleDraft.opmerking || "");
        setTemperatuurRegistraties(lokaleDraft.temperatuurRegistraties || []);
        setFotoUploads(lokaleDraft.fotoUploads || []);
        setVerzondenSignatuur(signatuur);
        verzondenSignatuurRef.current = signatuur;
        setStatus(statusBericht);

        return true;
      }

      try {
        const result = await fetchCleaningItems();

        if (negeerResultaat) return;

        if (!result.ok) {
          const lokaleDraftGeladen = laadLokaleDraftAlsFallback(
            "Lokale conceptversie geladen."
          );

          if (!lokaleDraftGeladen) {
            setStatus(result.message);
          }

          return;
        }

        const items = result.data;

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
        const geladenSignatuur = nieuwsteItem
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
          : "";

        setVerzondenSignatuur(geladenSignatuur);
        verzondenSignatuurRef.current = geladenSignatuur;

        if (opgeslagenItems.length > 0) {
          setStatus("Opgeslagen antwoorden geladen.");
        }
      } catch {
        if (!negeerResultaat) {
          const lokaleDraftGeladen = laadLokaleDraftAlsFallback(
            "Lokale conceptversie geladen."
          );

          if (!lokaleDraftGeladen) {
            setStatus("Eerdere antwoorden konden niet geladen worden.");
          }
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

      const volgendeTakenLijst = Array.from(volgendeTaken);
      setTaken(volgendeTakenLijst);
      planAutoSave(volgendeTakenLijst);
      return;
    }

    const volgendeTaken = taken.includes(taak.id)
      ? taken.filter((t) => t !== taak.id)
      : [...taken, taak.id];

    setTaken(volgendeTaken);
    planAutoSave(volgendeTaken);
  }

  function getAntwoorden(
    volgendeFotoUploads: PhotoUpload[] = fotoUploads,
    overrides: AntwoordOverrides = {}
  ): SchoonmaakAntwoorden {
    return {
      planType,
      naam: overrides.naam ?? naam,
      taken: (overrides.takenIds ?? taken).map((id) => taskLabelById[id] ?? id),
      opmerking: overrides.opmerking ?? opmerking,
      temperatuurRegistraties:
        overrides.temperatuurRegistraties ?? temperatuurRegistraties,
      fotoUploads: volgendeFotoUploads,
      verzondenSignatuur,
    };
  }

  function planAutoSave(volgendeTaken: string[]) {
    const antwoorden = getAntwoorden(fotoUploads, {
      takenIds: volgendeTaken,
    });
    const signatuur = maakSignatuur(antwoorden);

    bewaarLokaleDraft(winkel, datum, planType, antwoorden, signatuur);

    if (signatuur === verzondenSignatuurRef.current) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void submitAntwoorden(fotoUploads, {
        allowPartial: true,
        silent: true,
        skipIfUnchanged: true,
        takenIds: volgendeTaken,
      });
    }, 900);
  }

  function voegTemperatuurRegistratieToe() {
    setTemperatuurRegistraties((prev) => [
      ...prev,
      { id: maakTemperatuurId(), naam: "", temperatuur: "-" },
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
          {
            id: maakTemperatuurId(),
            naam,
            temperatuur: standaardTemperatuurWaarde(waarde),
          },
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
      photoUploadIdRef.current += 1;
      volgendeUploads = [
        ...fotoUploads.filter((upload) => upload.label !== label),
        {
          id: `${label}-${photoUploadIdRef.current}`,
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
    };
  }

  function valideerAntwoorden(
    volgendeFotoUploads: PhotoUpload[] = fotoUploads,
    options: SubmitOptions = {}
  ) {
    const antwoorden = getAntwoorden(volgendeFotoUploads, options);
    const heeftTemperatuur = antwoorden.temperatuurRegistraties.some(
      (item) =>
        item.naam.trim() || isTemperatuurWaardeIngevuld(item.temperatuur)
    );
    const heeftInhoud =
      antwoorden.naam.trim() ||
      antwoorden.taken.length > 0 ||
      antwoorden.opmerking.trim() ||
      heeftTemperatuur ||
      volgendeFotoUploads.length > 0;

    if (!heeftInhoud) {
      setStatus("Vul eerst iets in om op te slaan.");
      return false;
    }

    if (
      !options.allowPartial &&
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
    volgendeFotoUploads: PhotoUpload[] = fotoUploads,
    options: SubmitOptions = {}
  ) {
    if (!valideerAntwoorden(volgendeFotoUploads, options)) return;

    if (autoSaveTimerRef.current && !options.silent) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (!options.silent) {
      setStatus("Opslaan...");
    }
    setVerzendenBezig(true);

    let antwoorden = getAntwoorden(volgendeFotoUploads, options);
    let signatuur = maakSignatuur(antwoorden);

    if (
      options.skipIfUnchanged &&
      signatuur === verzondenSignatuurRef.current
    ) {
      setVerzendenBezig(false);
      return;
    }

    try {
      const fotoUploadsVoorOpslaan = await uploadNieuweFotos(
        volgendeFotoUploads
      );
      setFotoUploads(fotoUploadsVoorOpslaan);

      antwoorden = getAntwoorden(fotoUploadsVoorOpslaan, options);
      signatuur = maakSignatuur(antwoorden);

      if (
        options.skipIfUnchanged &&
        signatuur === verzondenSignatuurRef.current
      ) {
        return;
      }

      const result = await saveCleaningItem({
        titel: planType,
        winkel,
        naam: antwoorden.naam.trim(),
        datum,
        taken: withCleaningMetaMarkers(
          antwoorden.taken,
          planType,
          fotoUploadsVoorOpslaan
        ),
        opmerking: antwoorden.opmerking.trim(),
        temperatuurRegistraties: [
          ...antwoorden.temperatuurRegistraties
            .filter(
              (item) =>
                item.naam.trim() &&
                isTemperatuurWaardeIngevuld(item.temperatuur)
            )
            .map((item) => ({
              naam: item.naam.trim(),
              temperatuur: item.temperatuur.trim(),
            })),
          ...createPhotoTemperatureRegistrations(fotoUploadsVoorOpslaan),
        ],
        fotoUploads: fotoUploadsVoorOpslaan.map(serialiseerFotoUpload),
      });

      if (result.ok) {
        setVerzondenSignatuur(signatuur);
        verzondenSignatuurRef.current = signatuur;
        bewaarLokaleDraft(winkel, datum, planType, antwoorden, signatuur);
        setStatus(
          options.silent ? "Automatisch opgeslagen." : "Opgeslagen en verzonden."
        );
        return;
      }

      bewaarLokaleDraft(winkel, datum, planType, antwoorden, signatuur);

      if (result.status === 403) {
        setStatus(
          "Lokaal opgeslagen. Geen toegang vanuit WordPress; controleer de API sleutel."
        );
        return;
      }

      setStatus(`Lokaal opgeslagen. ${result.message}`);
    } catch (error) {
      bewaarLokaleDraft(winkel, datum, planType, antwoorden, signatuur);

      setStatus(
        error instanceof Error
          ? `Lokaal opgeslagen. ${error.message}`
          : "Lokaal opgeslagen. Kan geen verbinding maken met WordPress."
      );
    } finally {
      setVerzendenBezig(false);
    }
  }

  function opslaan() {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    void verzenden();
  }

  async function verzenden() {
    await submitAntwoorden();
  }

  function getTaakVoortgang(taak: Task) {
    const onderdelen = taak.children || [taak];
    const klaar = onderdelen.filter(isComplete).length;

    return {
      klaar,
      totaal: onderdelen.length,
    };
  }

  function openTaakInfo(taak: Task) {
    if (!taak.info) return;

    setActiveInfo({ title: taak.label, description: taak.info });
  }

  function renderInfoKnop(taak: Task) {
    if (!taak.info) return null;

    return (
      <span
        role="button"
        tabIndex={0}
        aria-label={`Uitleg over ${taak.label}`}
        onClick={(event) => {
          event.stopPropagation();
          openTaakInfo(taak);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          openTaakInfo(taak);
        }}
        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#d8d6cc] bg-white text-xs font-black text-[#3b6b43] shadow-sm"
      >
        i
      </span>
    );
  }

  function renderWaarschuwing(tekst?: string) {
    if (!tekst) return null;

    return (
      <div className="rounded-2xl border border-[#e4bf70] bg-[#fff7df] px-3 py-2 text-sm font-semibold leading-snug text-[#7a4f12]">
        <span className="mr-1 font-black uppercase tracking-[0.12em]">
          Let op
        </span>
        {tekst}
      </div>
    );
  }

  function renderSubtaak(subtaak: Task) {
    const voltooid = taken.includes(subtaak.id);

    return (
      <div key={subtaak.id} className="space-y-1.5">
        <button
          type="button"
          onClick={() => toggleTaak(subtaak)}
          className={`w-full rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${
            voltooid
              ? "border-[#b8ccb0] bg-[#eff6ec] text-[#243620]"
              : "border-[#e7e0d8] bg-white text-[#4f554c]"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black ${
                voltooid
                  ? "border-[#8fb184] bg-[#c3d3bc] text-[#243620]"
                  : "border-[#d8d6cc] bg-[#f8f6f3] text-transparent"
              }`}
            >
              ✓
            </span>
            <span className="min-w-0 flex-1 text-[0.95rem] font-semibold leading-snug">
              {subtaak.label}
            </span>
            {renderInfoKnop(subtaak)}
          </div>
        </button>
        {subtaak.description && (
          <p className="pl-10 text-xs font-medium leading-relaxed text-gray-500">
            {subtaak.description}
          </p>
        )}
        {subtaak.warning && (
          <div className="pl-9">{renderWaarschuwing(subtaak.warning)}</div>
        )}
      </div>
    );
  }

  function renderTaakKaart(taak: Task) {
    const voltooid = isComplete(taak);
    const voortgang = getTaakVoortgang(taak);

    return (
      <article
        key={taak.id}
        className={`space-y-3 rounded-[1.5rem] border bg-white p-4 shadow-sm transition ${
          voltooid ? "border-[#a9c29f]" : "border-[#e7e0d8]"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleTaak(taak)}
          className="w-full rounded-2xl text-left transition active:scale-[0.99]"
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                voltooid
                  ? "border-[#8fb184] bg-[#c3d3bc] text-[#243620]"
                  : "border-[#d8d6cc] bg-[#f8f6f3] text-[#6b7280]"
              }`}
            >
              {voltooid ? "✓" : voortgang.totaal}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="block text-base font-black leading-tight text-[#2d2a26]">
                  {taak.label}
                </span>
                {renderInfoKnop(taak)}
              </span>
              {taak.description && (
                <span className="mt-1 block text-sm font-semibold leading-snug text-gray-500">
                  {taak.description}
                </span>
              )}
              {taak.children && (
                <span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-[#6b7280]">
                  {voortgang.klaar}/{voortgang.totaal} klaar
                </span>
              )}
            </span>
          </div>
        </button>

        {renderWaarschuwing(taak.warning)}

        {taak.children && (
          <div className="space-y-2.5 rounded-[1.25rem] bg-[#f8f6f3] p-3">
            {taak.children.map(renderSubtaak)}
          </div>
        )}
      </article>
    );
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
              <p className="font-semibold">Werk per fase</p>
              <p className="mt-2">
                Vink de korte taken af. Tik op het info-rondje als je uitleg
                nodig hebt.
              </p>
            </div>
          )}

          {planType === "Afsluitplan" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#6b7280]">
                  Afsluiten
                </p>
                {ladenBezig && (
                  <span className="text-xs font-semibold text-gray-500">
                    Laden...
                  </span>
                )}
              </div>

              {afsluitTakenPerFase.map((groep, index) => (
                <section
                  key={groep.phase}
                  className="rounded-[2rem] bg-white/85 p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c3d3bc] text-sm font-black text-[#243620]">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-[#6b7280]">
                        Fase {index + 1}
                      </p>
                      <h2 className="text-xl font-black leading-tight text-[#2d2a26]">
                        {groep.phase}
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {groep.tasks.map(renderTaakKaart)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
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
                {takenLijst.map(renderTaakKaart)}
              </div>
            </div>
          )}

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
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
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
                        value={standaardTemperatuurWaarde(item.temperatuur)}
                        onChange={(e) =>
                          updateTemperatuurRegistratie(
                            item.id,
                            "temperatuur",
                            e.target.value
                          )
                        }
                        placeholder="Temperatuur"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
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
