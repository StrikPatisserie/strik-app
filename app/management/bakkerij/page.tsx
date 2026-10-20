"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import styles from "../../bakkerij/recepturen/OfferManager.module.css";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import {
  emptyBakeryHomeData,
  fetchRecepturenData,
  saveRecepturenData,
  type RecepturenData,
} from "../../bakkerij/recepturen/recepturenApi";
import type { BakeryHomeData, BakeryHomeOffer } from "../../bakkerij/recepturen/types";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();

  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + days);

  return dateKey(date);
}

function weekStartForDate(date = new Date()) {
  const nextDate = new Date(date);
  const day = nextDate.getDay() || 7;
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() - day + 1);

  return dateKey(nextDate);
}

function formatWeekRange(weekStart: string) {
  const start = dateFromKey(weekStart);
  const end = dateFromKey(addDays(weekStart, 6));
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
  });

  return `${formatter.format(start)} t/m ${formatter.format(end)}`;
}

function normalizeHome(value?: BakeryHomeData): BakeryHomeData {
  return {
    notes: Array.isArray(value?.notes) ? value.notes : [],
    offers: Array.isArray(value?.offers) ? value.offers : [],
  };
}

function offerForWeek(home: BakeryHomeData, weekStart: string) {
  return home.offers.find((offer) => offer.weekStart === weekStart);
}

export default function ManagementBakkerijPage() {
  const [data, setData] = useState<RecepturenData | null>(null);
  const [home, setHome] = useState<BakeryHomeData>(emptyBakeryHomeData);
  const [selectedWeek, setSelectedWeek] = useState(weekStartForDate);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("Laden...");
  const [isUploading, setIsUploading] = useState(false);
  const selectedOffer = offerForWeek(home, selectedWeek);

  useEffect(() => {
    let mounted = true;

    void fetchRecepturenData().then((result) => {
      if (!mounted) return;

      if (result.ok) {
        const normalizedHome = normalizeHome(result.data.bakeryHome);
        setData(result.data);
        setHome(normalizedHome);
        setLabel(offerForWeek(normalizedHome, selectedWeek)?.label || "");
        setStatus("");
      } else {
        setStatus(result.message);
      }
    });

    return () => {
      mounted = false;
    };
  }, [selectedWeek]);

  function selectWeek(nextWeek: string) {
    setSelectedWeek(nextWeek);
    setLabel(offerForWeek(home, nextWeek)?.label || "");
  }

  function selectRelativeWeek(days: number) {
    selectWeek(addDays(selectedWeek, days));
  }

  async function persistHome(nextHome: BakeryHomeData, message: string) {
    const nextData: RecepturenData = {
      ...data,
      ingredients: data?.ingredients || [],
      recipes: data?.recipes || [],
      invoiceImports: data?.invoiceImports || [],
      bakeryHome: nextHome,
    };

    setHome(nextHome);
    setStatus("Opslaan naar WordPress...");
    const result = await saveRecepturenData(nextData);

    if (result.ok) {
      setData(result.data);
      setHome(normalizeHome(result.data.bakeryHome));
      setStatus(message);
    } else {
      setStatus(`Lokaal bijgewerkt. ${result.message}`);
    }
  }

  async function uploadOfferImage(file: File | null) {
    if (!file) return;

    setIsUploading(true);
    setStatus("Aanbieding uploaden naar WordPress...");

    const formData = new FormData();
    formData.set("file", file);
    formData.set("weekStart", selectedWeek);
    formData.set("label", label);

    try {
      const response = await fetch("/api/recepturen/home-photo", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as
        | { id?: number; url?: string; fileName?: string; message?: string }
        | null;

      if (!response.ok || !result?.url) {
        setStatus(result?.message || "Aanbieding uploaden is niet gelukt.");
        return;
      }

      const now = new Date().toISOString();
      const currentOffer = offerForWeek(home, selectedWeek);
      const nextOffer: BakeryHomeOffer = {
        id: currentOffer?.id || `offer-${Date.now()}`,
        weekStart: selectedWeek,
        weekEnd: addDays(selectedWeek, 6),
        label: label.trim() || formatWeekRange(selectedWeek),
        imageUrl: result.url,
        mediaId: result.id || 0,
        fileName: result.fileName || file.name,
        createdAt: currentOffer?.createdAt || now,
        updatedAt: now,
      };

      await persistHome(
        {
          ...home,
          offers: [
            nextOffer,
            ...home.offers.filter((offer) => offer.weekStart !== selectedWeek),
          ],
        },
        "Aanbieding opgeslagen."
      );
    } catch {
      setStatus("De aanbieding kon niet worden geüpload. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Aanbieding"
        icon={strikIcons.bakkerij}
        kicker="Management"
        tone="green"
      />

      <section className={styles.panel}>
        <div className={styles.layout}>
          <div className={styles.form}>
            <div className={styles.weekPicker}>
              <button
                type="button"
                onClick={() => selectRelativeWeek(-7)}
                disabled={isUploading}
                aria-label="Vorige week"
              >
                ‹
              </button>
              <div>
                {formatWeekRange(selectedWeek)}
              </div>
              <button
                type="button"
                onClick={() => selectRelativeWeek(7)}
                disabled={isUploading}
                aria-label="Volgende week"
              >
                ›
              </button>
            </div>

            <label className={styles.field}>
              Label
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Bijvoorbeeld Vaderdag aanbieding"
                disabled={isUploading}
              />
            </label>

            <label className={styles.field}>
              Aanbiedingfoto
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isUploading || !data}
                onChange={(event) => {
                  void uploadOfferImage(event.currentTarget.files?.[0] || null);
                  event.currentTarget.value = "";
                }}
              />
            </label>

            {status && <p role="status" className={styles.status}>{status}</p>}
          </div>
          <div className={styles.preview}>
            <p>
              Huidige foto
            </p>
            <div className={styles.image}>
              {selectedOffer?.imageUrl ? (
                <img
                  src={selectedOffer.imageUrl}
                  alt={selectedOffer.label || "Aanbieding"}
                />
              ) : (
                <p>Nog geen foto voor deze week</p>
              )}
            </div>
          </div>

        </div>
      </section>
    </StrikShell>
  );
}
