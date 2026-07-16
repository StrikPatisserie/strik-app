"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updatePasswordAction,
  type AuthActionState,
} from "../lib/auth/actions";
import { createClient } from "../lib/supabase/client";

const initialState: AuthActionState = {};

function getResetLinkErrorMessage(value: string | null) {
  if (!value) return "";

  return "Deze resetlink is verlopen of niet geldig. Vraag een nieuwe resetmail aan.";
}

export default function UpdatePasswordPanel() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    initialState
  );
  const [linkMessage, setLinkMessage] = useState("Resetlink controleren...");
  const [linkReady, setLinkReady] = useState(false);

  useEffect(() => {
    let ignoreResult = false;

    async function loadRecoverySession() {
      const supabase = createClient();
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const linkError =
        getResetLinkErrorMessage(searchParams.get("error")) ||
        getResetLinkErrorMessage(hashParams.get("error"));

      if (linkError) {
        if (!ignoreResult) {
          setLinkReady(false);
          setLinkMessage(linkError);
        }

        return;
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!ignoreResult) {
          if (error) {
            setLinkReady(false);
            setLinkMessage(
              "Deze resetlink kon niet worden geladen. Vraag een nieuwe resetmail aan."
            );
          } else {
            setLinkReady(true);
            setLinkMessage("Resetlink geladen. Kies nu je nieuwe wachtwoord.");
            window.history.replaceState(null, "", window.location.pathname);
          }
        }

        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!ignoreResult) {
        if (data.session) {
          setLinkReady(true);
          setLinkMessage("Kies nu je nieuwe wachtwoord.");
        } else {
          setLinkReady(false);
          setLinkMessage(
            "Open de link uit de meest recente resetmail om je wachtwoord te wijzigen."
          );
        }
      }
    }

    void loadRecoverySession();

    return () => {
      ignoreResult = true;
    };
  }, []);

  return (
    <form
      action={formAction}
      className="w-full max-w-md space-y-3 border border-[#e4ded5] bg-white/92 p-4 shadow-sm sm:p-5"
    >
      {linkMessage && (
        <p
          className={`border px-3 py-2 text-sm font-bold ${
            linkReady
              ? "border-[#c8dbc2] bg-[#f3faf0] text-[#275d35]"
              : "border-[#f1b8a8] bg-[#fff4ef] text-[#bf3d26]"
          }`}
        >
          {linkMessage}
        </p>
      )}
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
        disabled={pending || !linkReady}
        className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-[#1f4f35] px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-65"
      >
        {pending ? "Opslaan..." : "Wachtwoord opslaan"}
      </button>
    </form>
  );
}
