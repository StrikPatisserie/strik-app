"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import NotificationMonitor from "./NotificationMonitor";
import WinkelSidebar from "./WinkelSidebar";

export default function AppChrome({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isBakeryEnvironment =
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

  return (
    <>
      <NotificationMonitor />
      <div className="min-h-dvh bg-[#faf8f5]">
        <div className="flex min-h-dvh flex-row">
          {!isBakeryEnvironment && <WinkelSidebar />}

          <main
            className={`flex-1 overflow-auto ${
              !isBakeryEnvironment
                ? isWinkelWorkArea
                  ? "pb-40 lg:pb-0"
                  : "pb-24 lg:pb-0"
                : ""
            }`}
          >
            {children}
          </main>
        </div>
      </div>
      {!isBakeryEnvironment && <BottomNav />}
    </>
  );
}
