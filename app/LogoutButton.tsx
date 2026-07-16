"use client";

import { logoutAction } from "./lib/auth/actions";

export default function LogoutButton() {
  return (
    <form action={logoutAction} className="fixed right-3 top-3 z-50">
      <button
        type="submit"
        className="h-9 rounded-md border border-[#e4ded5] bg-white/92 px-3 text-xs font-black uppercase text-[#6b645b] shadow-sm backdrop-blur transition hover:bg-[#f6faf4] hover:text-[#1f4f35]"
      >
        Uitloggen
      </button>
    </form>
  );
}
