"use client";

import { useMemo, useState } from "react";
import {
  cakeSizes,
  cakeStyles,
  colorOptions,
  decorationOptions,
  fillingOptions,
  initialWeddingCakeConfig,
  isLayoutAllowedForStyle,
  isOptionAllowedForStyle,
  layoutOptions,
  tastingOption,
  topperOptions,
} from "./data";
import {
  calculateWeddingCakePrice,
  createProductionForm,
  findOption,
  formatEuro,
  getSelectedWeddingCakeLabels,
} from "./pricing";
import { ContactDetails, StudioOption, WeddingCakeConfig } from "./types";

type StepId =
  | "stijl"
  | "formaat"
  | "smaak"
  | "kleur"
  | "layout"
  | "decoratie"
  | "topper"
  | "proefje"
  | "gegevens"
  | "overzicht";

const steps: { id: StepId; title: string; description: string }[] = [
  {
    id: "formaat",
    title: "Formaat",
    description:
      "Kies eerst het aantal personen en de opbouw uit de bruidstaartmogelijkheden.",
  },
  {
    id: "stijl",
    title: "Stijl",
    description: "Kies de basisafwerking van de taart.",
  },
  {
    id: "smaak",
    title: "Smaak",
    description: "Kies de vulling. Afwijkende wensen blijven op aanvraag.",
  },
  {
    id: "kleur",
    title: "Kleur",
    description: "Kies een kleur uit de waaier. Exacte tint stemmen we later af.",
  },
  {
    id: "layout",
    title: "Layout",
    description: "Kies de opbouw die past bij de gekozen stijl.",
  },
  {
    id: "decoratie",
    title: "Decoratie",
    description: "Meerdere decoraties combineren mag.",
  },
  {
    id: "topper",
    title: "Topper",
    description: "Kies een topper of extra add-on.",
  },
  {
    id: "proefje",
    title: "Bruidsproefje",
    description: "Voeg optioneel een proeverij toe aan de aanvraag.",
  },
  {
    id: "gegevens",
    title: "Gegevens",
    description: "Contact-, factuur- en leveringsgegevens.",
  },
  {
    id: "overzicht",
    title: "Overzicht",
    description: "Controleer de aanvraag en het bakkerijformulier.",
  },
];

function optionPriceLabel(option: StudioOption) {
  if (option.price.mode === "included") return "Inbegrepen";
  if (option.price.mode === "quote") return "Op aanvraag";
  if (option.price.mode === "perPerson") {
    return `${formatEuro(option.price.amount)} p.p.`;
  }

  return option.price.label
    ? `+ ${formatEuro(option.price.amount)} ${option.price.label}`
    : `+ ${formatEuro(option.price.amount)}`;
}

function OptionCard({
  option,
  selected,
  onClick,
}: {
  option: StudioOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.4rem] border p-4 text-left shadow-sm transition active:scale-[0.99] ${
        selected
          ? "border-[#8fb184] bg-[#dce8d6]"
          : "border-[#e7e0d8] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {option.swatchColor && (
            <span
              className="mt-0.5 h-12 w-12 shrink-0 rounded-full border-2 shadow-inner"
              style={{
                backgroundColor: option.swatchColor,
                borderColor: option.swatchBorder || "rgba(45, 42, 38, 0.12)",
              }}
            />
          )}
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight">{option.label}</p>
            {option.description && (
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#2d2a26]/55">
                {option.description}
              </p>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#2d2a26]/55">
          {optionPriceLabel(option)}
        </span>
      </div>
    </button>
  );
}

function SizeCard({
  sizeId,
  selected,
  onClick,
}: {
  sizeId: string;
  selected: boolean;
  onClick: () => void;
}) {
  const size = findOption(cakeSizes, sizeId) || cakeSizes[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.4rem] border p-4 text-left shadow-sm transition active:scale-[0.99] ${
        selected
          ? "border-[#8fb184] bg-[#dce8d6]"
          : "border-[#e7e0d8] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d2a26]/45">
            {size.code}
          </p>
          <p className="mt-1 text-lg font-bold">{size.label}</p>
        </div>
        {size.surchargePerPerson && (
          <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#8a5b10]">
            + {formatEuro(size.surchargePerPerson)} p.p.
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-semibold text-[#2d2a26]/55">
        {size.personsLabel} · {size.tiers} laag
        {size.tiers === 1 ? "" : "en"}
      </p>
      {size.description && (
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#2d2a26]/45">
          {size.description}
        </p>
      )}
    </button>
  );
}

function updateContact<K extends keyof ContactDetails>(
  config: WeddingCakeConfig,
  key: K,
  value: ContactDetails[K]
) {
  return {
    ...config,
    contact: {
      ...config.contact,
      [key]: value,
    },
  };
}

export default function BruidstaartStudioConfigurator() {
  const [config, setConfig] = useState<WeddingCakeConfig>(
    initialWeddingCakeConfig
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const step = steps[stepIndex];

  const allowedLayouts = useMemo(
    () =>
      layoutOptions.filter((option) =>
        isLayoutAllowedForStyle(option, config.styleId)
      ),
    [config.styleId]
  );
  const allowedColors = useMemo(
    () =>
      colorOptions.filter((option) =>
        isOptionAllowedForStyle(option, config.styleId)
      ),
    [config.styleId]
  );

  const price = useMemo(() => calculateWeddingCakePrice(config), [config]);
  const labels = useMemo(() => getSelectedWeddingCakeLabels(config), [config]);
  const productionForm = useMemo(() => createProductionForm(config), [config]);

  function setStyle(styleId: WeddingCakeConfig["styleId"]) {
    const firstLayout =
      layoutOptions.find((option) => isLayoutAllowedForStyle(option, styleId))
        ?.id || config.layoutId;
    const firstColor =
      colorOptions.find((option) => isOptionAllowedForStyle(option, styleId))
        ?.id || config.colorId;

    setConfig((current) => ({
      ...current,
      styleId,
      colorId: isOptionAllowedForStyle(
        findOption(colorOptions, current.colorId) || colorOptions[0],
        styleId
      )
        ? current.colorId
        : firstColor,
      layoutId: isLayoutAllowedForStyle(
        findOption(layoutOptions, current.layoutId) || layoutOptions[0],
        styleId
      )
        ? current.layoutId
        : firstLayout,
    }));
  }

  function toggleDecoration(id: string) {
    setConfig((current) => ({
      ...current,
      decorationIds: current.decorationIds.includes(id)
        ? current.decorationIds.filter((item) => item !== id)
        : [...current.decorationIds, id],
    }));
  }

  function toggleTopper(id: string) {
    const option = findOption(topperOptions, id);
    if (!option) return;

    setConfig((current) => {
      if (id === "geen") {
        return { ...current, topperIds: ["geen"] };
      }

      const isSelected = current.topperIds.includes(id);
      let nextIds = current.topperIds.filter((topperId) => topperId !== "geen");

      if (isSelected) {
        nextIds = nextIds.filter((topperId) => topperId !== id);
      } else {
        if (option.selectionGroup && option.selectionGroup !== "extraTopper") {
          nextIds = nextIds.filter((topperId) => {
            const existingOption = findOption(topperOptions, topperId);
            return existingOption?.selectionGroup !== option.selectionGroup;
          });
        }
        nextIds = [...nextIds, id];
      }

      return {
        ...current,
        topperIds: nextIds.length ? nextIds : ["geen"],
      };
    });
  }

  async function copyProductionForm() {
    try {
      await navigator.clipboard.writeText(productionForm);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < steps.length - 1;

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d2a26]/45">
              Stap {stepIndex + 1} van {steps.length}
            </p>
            <h2 className="mt-1 text-2xl font-bold">{step.title}</h2>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#2d2a26]/55">
              {step.description}
            </p>
          </div>
          <div className="rounded-2xl bg-[#f1d28f]/70 px-4 py-3 text-right">
            <p className="text-xs font-bold text-[#2d2a26]/55">Indicatie</p>
            <p className="text-xl font-black">{formatEuro(price.total)}</p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-[#f8f6f3]">
          <div
            className="h-full rounded-full bg-[#c3d3bc]"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
          {step.id === "stijl" && (
            <div className="grid gap-3">
              {cakeStyles.map((style) => (
                <OptionCard
                  key={style.id}
                  option={style}
                  selected={config.styleId === style.id}
                  onClick={() => setStyle(style.id)}
                />
              ))}
            </div>
          )}

          {step.id === "formaat" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {cakeSizes.map((size) => (
                <SizeCard
                  key={size.id}
                  sizeId={size.id}
                  selected={config.sizeId === size.id}
                  onClick={() =>
                    setConfig((current) => ({ ...current, sizeId: size.id }))
                  }
                />
              ))}
            </div>
          )}

          {step.id === "smaak" && (
            <div className="grid gap-3">
              {fillingOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  selected={config.fillingId === option.id}
                  onClick={() =>
                    setConfig((current) => ({
                      ...current,
                      fillingId: option.id,
                    }))
                  }
                />
              ))}
            </div>
          )}

          {step.id === "kleur" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {allowedColors.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  selected={config.colorId === option.id}
                  onClick={() =>
                    setConfig((current) => ({
                      ...current,
                      colorId: option.id,
                    }))
                  }
                />
              ))}
            </div>
          )}

          {step.id === "layout" && (
            <div className="grid gap-3">
              {allowedLayouts.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  selected={config.layoutId === option.id}
                  onClick={() =>
                    setConfig((current) => ({
                      ...current,
                      layoutId: option.id,
                    }))
                  }
                />
              ))}
            </div>
          )}

          {step.id === "decoratie" && (
            <div className="grid gap-3">
              {decorationOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  selected={config.decorationIds.includes(option.id)}
                  onClick={() => toggleDecoration(option.id)}
                />
              ))}
            </div>
          )}

          {step.id === "topper" && (
            <div className="grid gap-3">
              {topperOptions.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  selected={config.topperIds.includes(option.id)}
                  onClick={() => toggleTopper(option.id)}
                />
              ))}
            </div>
          )}

          {step.id === "proefje" && (
            <div className="space-y-4">
              <OptionCard
                option={tastingOption}
                selected={config.tasting}
                onClick={() =>
                  setConfig((current) => ({
                    ...current,
                    tasting: !current.tasting,
                  }))
                }
              />
              <p className="rounded-2xl bg-[#f8f6f3] p-4 text-sm font-semibold leading-relaxed text-[#2d2a26]/60">
                Dit is een aanvraag. Het proefmoment wordt later definitief
                gepland door Strik.
              </p>
            </div>
          )}

          {step.id === "gegevens" && (
            <div className="grid gap-3">
              <input
                value={config.contact.names}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(current, "names", event.target.value)
                  )
                }
                placeholder="Namen bruidspaar"
                className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={config.contact.email}
                  onChange={(event) =>
                    setConfig((current) =>
                      updateContact(current, "email", event.target.value)
                    )
                  }
                  placeholder="E-mail"
                  type="email"
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
                />
                <input
                  value={config.contact.phone}
                  onChange={(event) =>
                    setConfig((current) =>
                      updateContact(current, "phone", event.target.value)
                    )
                  }
                  placeholder="Telefoon"
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
                />
              </div>
              <input
                value={config.contact.weddingDate}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(current, "weddingDate", event.target.value)
                  )
                }
                type="date"
                className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {(["pickup", "delivery"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() =>
                      setConfig((current) =>
                        updateContact(current, "deliveryMethod", method)
                      )
                    }
                    className={`rounded-2xl border p-4 text-left font-bold ${
                      config.contact.deliveryMethod === method
                        ? "border-[#8fb184] bg-[#dce8d6]"
                        : "border-[#e7e0d8] bg-white"
                    }`}
                  >
                    {method === "pickup" ? "Afhalen" : "Bezorgen"}
                  </button>
                ))}
              </div>
              <textarea
                value={config.contact.deliveryAddress}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(
                      current,
                      "deliveryAddress",
                      event.target.value
                    )
                  )
                }
                placeholder="Leveringsadres of afhaallocatie"
                className="min-h-24 rounded-2xl border border-[#e7e0d8] bg-white p-4"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={config.contact.invoiceName}
                  onChange={(event) =>
                    setConfig((current) =>
                      updateContact(current, "invoiceName", event.target.value)
                    )
                  }
                  placeholder="Factuurnaam"
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
                />
                <input
                  value={config.contact.invoiceEmail}
                  onChange={(event) =>
                    setConfig((current) =>
                      updateContact(current, "invoiceEmail", event.target.value)
                    )
                  }
                  placeholder="Factuur e-mail"
                  type="email"
                  className="rounded-2xl border border-[#e7e0d8] bg-white p-4"
                />
              </div>
              <textarea
                value={config.contact.notes}
                onChange={(event) =>
                  setConfig((current) =>
                    updateContact(current, "notes", event.target.value)
                  )
                }
                placeholder="Extra wensen, allergenen, planning, inspiratie"
                className="min-h-32 rounded-2xl border border-[#e7e0d8] bg-white p-4"
              />
            </div>
          )}

          {step.id === "overzicht" && (
            <div className="space-y-4">
              <div className="rounded-[1.5rem] bg-[#f8f6f3] p-4">
                <h3 className="text-xl font-bold">Bakkerijformulier</h3>
                <p className="mt-1 text-sm font-semibold text-[#2d2a26]/55">
                  Dit is een aanvraag en nog geen definitieve bestelling.
                </p>
              </div>
              <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 text-sm leading-relaxed">
                {productionForm}
              </pre>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={copyProductionForm}
                  className="rounded-full bg-[#c3d3bc] p-4 font-bold"
                >
                  {copied ? "Gekopieerd" : "Formulier kopiëren"}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-full bg-[#f1d28f] p-4 font-bold"
                >
                  Printen
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="h-fit rounded-[1.75rem] border border-[#e7e0d8] bg-white/90 p-5 shadow-sm lg:sticky lg:top-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2d2a26]/45">
            Live prijs
          </p>
          <p className="mt-1 text-3xl font-black">{formatEuro(price.total)}</p>
          {price.hasQuoteItems && (
            <p className="mt-2 rounded-2xl bg-[#fff7e3] p-3 text-xs font-bold leading-relaxed text-[#5d4717]">
              Sommige onderdelen staan op aanvraag en zitten nog niet in het
              totaal.
            </p>
          )}

          <div className="mt-5 space-y-3 text-sm">
            <p>
              <span className="font-bold">Stijl:</span> {labels.style}
            </p>
            <p>
              <span className="font-bold">Formaat:</span> {labels.size}
            </p>
            <p>
              <span className="font-bold">Smaak:</span> {labels.filling}
            </p>
            <p>
              <span className="font-bold">Decoratie:</span>{" "}
              {labels.decorations.length ? labels.decorations.join(", ") : "geen"}
            </p>
          </div>

          <div className="mt-5 border-t border-[#e7e0d8] pt-4">
            {price.lines.map((line) => (
              <div
                key={line.label}
                className="mb-2 flex items-start justify-between gap-3 text-sm"
              >
                <span className="leading-snug text-[#2d2a26]/65">
                  {line.label}
                </span>
                <span className="shrink-0 font-bold">
                  {line.quote ? "n.t.b." : formatEuro(line.amount)}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          disabled={!canGoBack}
          className="rounded-full bg-white px-5 py-4 font-bold shadow-sm disabled:opacity-40"
        >
          Vorige
        </button>
        <button
          type="button"
          onClick={() =>
            setStepIndex((current) => Math.min(steps.length - 1, current + 1))
          }
          disabled={!canGoNext}
          className="min-w-0 flex-1 rounded-full bg-[#c3d3bc] px-5 py-4 font-bold shadow-sm disabled:opacity-40"
        >
          {canGoNext ? "Volgende stap" : "Aanvraag compleet"}
        </button>
      </div>
    </div>
  );
}
