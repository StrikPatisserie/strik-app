"use client";

import { useActionState, useState } from "react";
import {
  loginAction,
  requestPasswordResetAction,
  type AuthActionState,
} from "../lib/auth/actions";

const initialState: AuthActionState = {};

function SubmitButton({
  pending,
  children,
}: Readonly<{ pending: boolean; children: React.ReactNode }>) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-[#1f4f35] px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-65"
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
  initialMode?: "login" | "reset";
}>) {
  const [mode, setMode] = useState<"login" | "reset">(initialMode);
  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    initialState
  );
  const [resetState, resetFormAction, resetPending] = useActionState(
    requestPasswordResetAction,
    initialState
  );
  const activeState = mode === "login" ? loginState : resetState;

  return (
    <section className="w-full max-w-md border border-[#e4ded5] bg-white/92 p-4 shadow-sm sm:p-5">
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-[#f4f0ea] p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`h-10 rounded text-sm font-black ${
            mode === "login"
              ? "bg-white text-[#1f4f35] shadow-sm"
              : "text-[#7b7268]"
          }`}
        >
          Inloggen
        </button>
        <button
          type="button"
          onClick={() => setMode("reset")}
          className={`h-10 rounded text-sm font-black ${
            mode === "reset"
              ? "bg-white text-[#1f4f35] shadow-sm"
              : "text-[#7b7268]"
          }`}
        >
          Wachtwoord
        </button>
      </div>

      {status === "inactive" && (
        <p className="mb-3 border border-[#f1b8a8] bg-[#fff4ef] px-3 py-2 text-sm font-bold text-[#bf3d26]">
          Dit account is gedeactiveerd.
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
            <span className="mb-1 block text-xs font-black uppercase text-[#7b7268]">
              E-mail
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-12 w-full rounded-md border border-[#ded8cf] bg-[#faf8f5] px-3 text-base font-semibold outline-none focus:border-[#1f4f35]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#7b7268]">
              Wachtwoord
            </span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-12 w-full rounded-md border border-[#ded8cf] bg-[#faf8f5] px-3 text-base font-semibold outline-none focus:border-[#1f4f35]"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-[#5f574f]">
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
      ) : (
        <form action={resetFormAction} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-[#7b7268]">
              E-mail
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-12 w-full rounded-md border border-[#ded8cf] bg-[#faf8f5] px-3 text-base font-semibold outline-none focus:border-[#1f4f35]"
            />
          </label>
          <SubmitButton pending={resetPending}>Stuur resetlink</SubmitButton>
        </form>
      )}
    </section>
  );
}
