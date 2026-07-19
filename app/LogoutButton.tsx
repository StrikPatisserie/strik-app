"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "./lib/supabase/client";
import type { UserProfile } from "./lib/supabase/types";

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function LogoutButton({
  profile,
}: Readonly<{ profile: UserProfile | null }>) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const name = profile?.full_name || profile?.email || "Account";

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
    <div ref={menuRef} className="fixed right-3 top-3 z-50">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={pending}
        aria-label="Accountmenu openen"
        aria-expanded={open}
        className="grid h-10 w-10 place-items-center rounded-full border border-[#d7d0c7] bg-white/94 text-[#1f4f35] shadow-sm backdrop-blur transition hover:bg-[#f6faf4] disabled:cursor-wait disabled:opacity-65"
      >
        <UserIcon />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-[#e4ded5] bg-white/95 text-[#1a1815] shadow-lg backdrop-blur">
          <div className="border-b border-[#eee8df] px-3 py-2">
            <p className="truncate text-sm font-black">{name}</p>
            {profile?.email && (
              <p className="truncate text-[0.7rem] font-bold text-[#7b7268]">
                {profile.email}
              </p>
            )}
          </div>
          <Link
            href="/profiel"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-black transition hover:bg-[#f6faf4] hover:text-[#1f4f35]"
          >
            Mijn profiel
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={pending}
            className="block w-full px-3 py-2 text-left text-sm font-black text-[#bf3d26] transition hover:bg-[#fff4ef] disabled:cursor-wait disabled:opacity-65"
          >
            {pending ? "Uitloggen..." : "Uitloggen"}
          </button>
        </div>
      )}
    </div>
  );
}
