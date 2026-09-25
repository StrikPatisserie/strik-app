"use client";

import { useActionState, useState } from "react";
import {
  loginAction,
  requestPasswordResetAction,
  signupAction,
  type AuthActionState,
} from "../lib/auth/actions";
import { SIGNUP_DEPARTMENTS, WINKEL_STORE_IDS } from "../lib/auth/access";

const initialState: AuthActionState = {};

const fieldClassName =
  "h-11 w-full rounded-xl border border-[#d9d2c9] bg-white px-3 text-sm font-bold text-[#1a1815] outline-none transition placeholder:text-[#9b948b] focus:border-[#24553d] focus:ring-2 focus:ring-[#c3d3bc]/70";

const fieldLabelClassName =
  "mb-1 block text-[0.65rem] font-black uppercase tracking-[0.13em] text-[#6b645b]";

function SubmitButton({
  pending,
  children,
}: Readonly<{ pending: boolean; children: React.ReactNode }>) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#24553d] px-4 text-sm font-black text-white shadow-[0_8px_18px_rgba(24,61,41,.18)] transition hover:bg-[#183d29] active:scale-[0.98] disabled:cursor-wait disabled:opacity-65"
    >
      {pending ? "Even bezig..." : children}
    </button>
  );
}

export default function LoginPanel({
  next,
  status,
  initialMode = "login",
}: Readonly<{
  next: string;
  status?: string;
  initialMode?: "login" | "signup" | "reset";
}>) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">(initialMode);
  const [signupDepartment, setSignupDepartment] = useState("winkel");
  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    initialState
  );
  const [signupState, signupFormAction, signupPending] = useActionState(
    signupAction,
    initialState
  );
  const [resetState, resetFormAction, resetPending] = useActionState(
    requestPasswordResetAction,
    initialState
  );
  const activeState =
    mode === "login" ? loginState : mode === "signup" ? signupState : resetState;
  const panelCopy =
    mode === "login"
      ? {
          eyebrow: "Fijn dat je er bent",
          title: "Inloggen",
          description: "Vul je gegevens in om de Team App te openen.",
        }
      : mode === "signup"
        ? {
            eyebrow: "Nieuw bij Strik",
            title: "Toegang aanvragen",
            description: "Maak een account aan; een beheerder keurt je aanvraag goed.",
          }
        : {
            eyebrow: "Geen probleem",
            title: "Wachtwoord herstellen",
            description: "Je ontvangt per e-mail een veilige resetlink.",
          };

  return (
    <section className="relative w-full overflow-hidden rounded-[1.75rem] border border-white/70 bg-[#fffaf0] p-4 shadow-[0_24px_65px_rgba(24,61,41,.2)] sm:p-6">
      <div className="absolute right-0 top-0 h-2 w-24 rounded-bl-full bg-[#f3d875]" />

      <header className="mb-5 pr-8">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-[#ef7555]">
          {panelCopy.eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#183d29] sm:text-3xl">
          {panelCopy.title}
        </h2>
        <p className="mt-1 text-xs font-bold leading-relaxed text-[#6b645b] sm:text-sm">
          {panelCopy.description}
        </p>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-[#e7eee3] p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`min-h-9 rounded-lg px-1 text-[0.68rem] font-black transition sm:text-xs ${
            mode === "login"
              ? "bg-[#24553d] text-white shadow-sm"
              : "text-[#54705e] hover:bg-white/55"
          }`}
        >
          Inloggen
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`min-h-9 rounded-lg px-1 text-[0.68rem] font-black transition sm:text-xs ${
            mode === "signup"
              ? "bg-[#24553d] text-white shadow-sm"
              : "text-[#54705e] hover:bg-white/55"
          }`}
        >
          Aanvragen
        </button>
        <button
          type="button"
          onClick={() => setMode("reset")}
          className={`min-h-9 rounded-lg px-1 text-[0.68rem] font-black transition sm:text-xs ${
            mode === "reset"
              ? "bg-[#24553d] text-white shadow-sm"
              : "text-[#54705e] hover:bg-white/55"
          }`}
        >
          Wachtwoord
        </button>
      </div>

      {status === "inactive" && (
        <p className="mb-3 border border-[#f1b8a8] bg-[#fff4ef] px-3 py-2 text-sm font-bold text-[#bf3d26]">
          Dit account wacht nog op goedkeuring of is gedeactiveerd. Neem contact op met de beheerder.
        </p>
      )}

      {activeState.message && (
        <p
          className={`mb-3 border px-3 py-2 text-sm font-bold ${
            activeState.ok
              ? "border-[#c8dbc2] bg-[#f3faf0] text-[#275d35]"
              : "border-[#f1b8a8] bg-[#fff4ef] text-[#bf3d26]"
          }`}
        >
          {activeState.message}
        </p>
      )}

      {mode === "login" ? (
        <form action={loginFormAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className={fieldLabelClassName}>
              E-mail
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className={fieldClassName}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClassName}>
              Wachtwoord
            </span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={fieldClassName}
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-[#5f574f] sm:text-sm">
            <input
              name="remember"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 accent-[#1f4f35]"
            />
            Ingelogd blijven
          </label>
          <SubmitButton pending={loginPending}>Open Strik Team App</SubmitButton>
        </form>
      ) : mode === "signup" ? (
        <form action={signupFormAction} className="space-y-3">
          <label className="block">
            <span className={fieldLabelClassName}>
              Naam
            </span>
            <input
              name="full_name"
              autoComplete="name"
              required
              className={fieldClassName}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClassName}>
              E-mail
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className={fieldClassName}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClassName}>
              Wachtwoord
            </span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={fieldClassName}
            />
            <span className="mt-1 block text-xs font-semibold text-[#7b7268]">
              Minimaal 8 tekens. Werkt het niet? Gebruik een hoofdletter,
              cijfer en teken.
            </span>
          </label>
          <div>
            <span className={fieldLabelClassName}>
              Gewenste afdeling
            </span>
            <div className="grid gap-2">
              {SIGNUP_DEPARTMENTS.map((department) => (
                <label
                  key={department.id}
                  className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#d9d2c9] bg-white px-3 py-2 text-sm font-bold text-[#4f4942] transition hover:border-[#9eb497]"
                >
                  <input
                    name="department"
                    type="radio"
                    value={department.id}
                    required
                    defaultChecked={department.id === "winkel"}
                    onChange={() => setSignupDepartment(department.id)}
                    className="mt-1 h-4 w-4 accent-[#1f4f35]"
                  />
                  <span>
                    <span className="block font-black text-[#1a1815]">
                      {department.label}
                    </span>
                    <span className="block text-xs font-semibold text-[#7b7268]">
                      {department.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {signupDepartment === "winkel" && (
            <label className="block">
              <span className={fieldLabelClassName}>
                Gewenste winkel
              </span>
              <select name="store" required defaultValue="" className={fieldClassName}>
                <option value="" disabled>Kies je winkel</option>
                {WINKEL_STORE_IDS.map((store) => (
                  <option key={store} value={store}>
                    {store === "ziekerstraat" ? "Ziekerstraat" : store === "heyendaal" ? "Heyendaal" : store === "daalseweg" ? "Daalseweg" : "Lent"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-xs font-semibold text-[#7b7268]">Je account wordt pas actief nadat een beheerder je aanvraag heeft goedgekeurd.</p>
          <SubmitButton pending={signupPending}>Toegang aanvragen</SubmitButton>
        </form>
      ) : (
        <form action={resetFormAction} className="space-y-3">
          <label className="block">
            <span className={fieldLabelClassName}>
              E-mail
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className={fieldClassName}
            />
          </label>
          <SubmitButton pending={resetPending}>Stuur resetlink</SubmitButton>
        </form>
      )}
    </section>
  );
}
