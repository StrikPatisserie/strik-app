"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import LogoutButton from "./LogoutButton";
import NotificationMonitor from "./NotificationMonitor";
import WinkelSidebar from "./WinkelSidebar";
import type { UserProfile } from "./lib/supabase/types";

export default function AppChrome({
  children,
  profile,
}: Readonly<{ children: React.ReactNode; profile: UserProfile | null }>) {
  const pathname = usePathname();
  const isAuthArea =
    pathname === "/login" ||
    pathname === "/reset-password" ||
    pathname === "/update-password" ||
    pathname.startsWith("/auth/");
  const isBakeryWorkArea =
    pathname === "/bakkerij" || pathname.startsWith("/bakkerij/");
  const isWinkelWorkArea =
    pathname === "/winkel" ||
    pathname.startsWith("/winkel/") ||
    pathname.startsWith("/nieuws") ||
    pathname.startsWith("/strik-agenda") ||
    pathname.startsWith("/info") ||
    pathname.startsWith("/bruidstaarten") ||
    pathname === "/schoonmaak" ||
    pathname.startsWith("/schoonmaak/");
  const isWorkArea = isWinkelWorkArea || isBakeryWorkArea;
  const isVierdaagseWorkArea =
    pathname === "/vierdaagse" || pathname.startsWith("/vierdaagse/");

  if (isAuthArea) {
    return <>{children}</>;
  }

  return (
    <>
      <NotificationMonitor />
      <LogoutButton />
      <div className="min-h-dvh bg-[#faf8f5]">
        <div className="flex min-h-dvh flex-row">
          <WinkelSidebar profile={profile} />

          <main
            className={`flex-1 overflow-auto ${
              isWorkArea || isVierdaagseWorkArea
                ? "pb-32 md:pb-0"
                : "pb-24 md:pb-0"
            }`}
          >
            {children}
          </main>
        </div>
      </div>
      <BottomNav profile={profile} />
    </>
  );
}
