"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import {
  emptyBakeryHomeData,
  fetchRecepturenData,
  saveRecepturenData,
  type RecepturenData,
} from "../../bakkerij/recepturen/recepturenApi";
import type { BakeryHomeData, BakeryHomeOffer } from "../../bakkerij/recepturen/types";

const fallbackOfferImageUrl = "/bakkerij-aanbieding-papa.png";

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
        setStatus("Bakkerij voorpagina geladen.");
      } else {
        setStatus(result.message);
      }
    });

    return () => {
      mounted = false;
    };
  }, [selectedWeek]);

  useEffect(() => {
    setLabel(selectedOffer?.label || "");
  }, [selectedOffer?.label, selectedWeek]);

  async function persistHome(nextHome: BakeryHomeData, message: string) {
    const nextData: RecepturenData = {
      ingredients: data?.ingredients || [],
      recipes: data?.recipes || [],
      packagingItems: data?.packagingItems || [],
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
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Bakkerij voorpagina"
        description="Beheer de aanbiedingsfoto per week."
        icon={strikIcons.bakkerij}
        kicker="Management"
        tone="green"
      />

      <section className="grid gap-4 rounded-[1.5rem] border border-[#e7e0d8] bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]">
          <button
            type="button"
            onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
            className="border border-[#c3d3bc] bg-[#c3d3bc] text-3xl leading-none"
            aria-label="Vorige week"
          >
            ‹
          </button>
          <div className="flex items-center justify-center border border-[#c3d3bc] px-3 py-2 text-sm font-black uppercase tracking-[0.08em]">
            {formatWeekRange(selectedWeek)}
          </div>
          <button
            type="button"
            onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
            className="border border-[#c3d3bc] bg-[#c3d3bc] text-3xl leading-none"
            aria-label="Volgende week"
          >
            ›
          </button>
        </div>

        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
          Label
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Bijvoorbeeld Vaderdag aanbieding"
            className="border border-[#c3d3bc] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#252525] outline-none"
          />
        </label>

        <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
          Aanbiedingfoto
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isUploading}
            onChange={(event) => {
              void uploadOfferImage(event.currentTarget.files?.[0] || null);
              event.currentTarget.value = "";
            }}
            className="border border-[#c3d3bc] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#252525]"
          />
        </label>

        <div className="border border-[#c3d3bc] bg-[#f8f8f6] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
            Huidige foto
          </p>
          <div className="flex max-h-[28rem] items-center justify-center overflow-hidden bg-white">
            <img
              src={selectedOffer?.imageUrl || fallbackOfferImageUrl}
              alt={selectedOffer?.label || "Aanbieding"}
              className="max-h-[28rem] max-w-full object-contain"
            />
          </div>
        </div>

        {status && (
          <p className="rounded-2xl bg-[#f8f6f3] p-3 text-center text-sm font-bold text-[#707070]">
            {status}
          </p>
        )}
      </section>
    </StrikShell>
  );
}
