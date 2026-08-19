"use client";

/* eslint-disable @next/next/no-img-element */
import { useActionState } from "react";
import {
  SEASONAL_NAVIGATION_SETTINGS,
  type FeatureVisibilitySettings,
} from "../../featureVisibility";
import { strikIcons } from "../../StrikUI";
import {
  updateFeatureVisibilityAction,
  type AppSettingsActionState,
} from "./actions";

const initialState: AppSettingsActionState = {};

function Message({ state }: Readonly<{ state: AppSettingsActionState }>) {
  if (!state.message) return null;

  return (
    <p
      className={`rounded-md border px-3 py-2 text-sm font-bold ${
        state.ok
          ? "border-[#c8dbc2] bg-[#f3faf0] text-[#275d35]"
          : "border-[#f1b8a8] bg-[#fff4ef] text-[#bf3d26]"
      }`}
    >
      {state.message}
    </p>
  );
}

const seasonalIcons: Record<keyof FeatureVisibilitySettings, string> = {
  vierdaagseNavigation: strikIcons.strikAgenda,
  sinterklaasNavigation: strikIcons.sinterklaas,
};

function SeasonalToggle({
  checked,
  description,
  icon,
  name,
  title,
}: Readonly<{
  checked: boolean;
  description: string;
  icon: string;
  name: keyof FeatureVisibilitySettings;
  title: string;
}>) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-[#ebe5dc] bg-[#faf8f5] p-3">
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#ecf4ed]">
          <img src={icon} alt="" className="h-7 w-7 object-contain" />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-black text-[#1a1815]">
            {title}
          </span>
          <span className="mt-1 block text-sm font-bold leading-snug text-[#6b645b]">
            {description}
          </span>
        </span>
      </span>

      <span className="relative inline-flex h-8 w-14 shrink-0 items-center">
        <input
          name={name}
          type="checkbox"
          defaultChecked={checked}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-[#d8d0c5] transition peer-checked:bg-[#1f4f35]" />
        <span className="absolute left-1 h-6 w-6 rounded-full bg-white shadow-sm transition peer-checked:translate-x-6" />
      </span>
    </label>
  );
}

export default function AppSettingsClient({
  featureVisibility,
}: Readonly<{ featureVisibility: FeatureVisibilitySettings }>) {
  const [state, formAction, pending] = useActionState(
    updateFeatureVisibilityAction,
    initialState
  );

  return (
    <section className="max-w-3xl rounded-lg border border-[#e4ded5] bg-white/92 p-4 shadow-sm">
      <form action={formAction} className="space-y-4">
        <Message state={state} />

        <div className="grid gap-2">
          {SEASONAL_NAVIGATION_SETTINGS.map((setting) => (
            <SeasonalToggle
              key={setting.key}
              name={setting.key}
              title={setting.title}
              description={setting.description}
              icon={seasonalIcons[setting.key]}
              checked={featureVisibility[setting.key]}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md bg-[#1f4f35] px-4 text-sm font-black text-white disabled:opacity-60"
        >
          {pending ? "Opslaan..." : "Instellingen opslaan"}
        </button>
      </form>
    </section>
  );
}
