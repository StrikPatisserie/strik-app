"use client";

import { useActionState } from "react";
import {
  updatePasswordAction,
  type AuthActionState,
} from "../lib/auth/actions";

const initialState: AuthActionState = {};

export default function UpdatePasswordPanel() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    initialState
  );

  return (
    <form
      action={formAction}
      className="w-full max-w-md space-y-3 border border-[#e4ded5] bg-white/92 p-4 shadow-sm sm:p-5"
    >
      {state.message && (
        <p className="border border-[#f1b8a8] bg-[#fff4ef] px-3 py-2 text-sm font-bold text-[#bf3d26]">
          {state.message}
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-black uppercase text-[#7b7268]">
          Nieuw wachtwoord
        </span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-12 w-full rounded-md border border-[#ded8cf] bg-[#faf8f5] px-3 text-base font-semibold outline-none focus:border-[#1f4f35]"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-black uppercase text-[#7b7268]">
          Herhaal wachtwoord
        </span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-12 w-full rounded-md border border-[#ded8cf] bg-[#faf8f5] px-3 text-base font-semibold outline-none focus:border-[#1f4f35]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-[#1f4f35] px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-65"
      >
        {pending ? "Opslaan..." : "Wachtwoord opslaan"}
      </button>
    </form>
  );
}
