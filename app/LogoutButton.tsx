"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "./lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);

    try {
      const supabase = createClient();
      await fetch("/auth/signout", { method: "POST" });
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="fixed right-3 top-3 z-50 h-9 rounded-md border border-[#e4ded5] bg-white/92 px-3 text-xs font-black uppercase text-[#6b645b] shadow-sm backdrop-blur transition hover:bg-[#f6faf4] hover:text-[#1f4f35] disabled:cursor-wait disabled:opacity-65"
    >
      {pending ? "Uitloggen..." : "Uitloggen"}
    </button>
  );
}
