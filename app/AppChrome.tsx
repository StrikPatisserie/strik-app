"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import LogoutButton from "./LogoutButton";
import NotificationMonitor from "./NotificationMonitor";
import WinkelSidebar from "./WinkelSidebar";
import type { FeatureVisibilitySettings } from "./featureVisibility";
import type { UserProfile } from "./lib/supabase/types";

export default function AppChrome({
  children,
  featureVisibility,
  profile,
}: Readonly<{
  children: React.ReactNode;
  featureVisibility: FeatureVisibilitySettings;
  profile: UserProfile | null;
}>) {
  const pathname = usePathname();
  const isAuthArea =
    pathname === "/login" ||
    pathname === "/reset-password" ||
    pathname === "/update-password" ||
    pathname.startsWith("/auth/");
  const isPrintArea = pathname === "/bakkerij/logistiek/arend-print";
  const isLogistiekWorkArea =
    pathname === "/bakkerij/logistiek" ||
    pathname.startsWith("/bakkerij/logistiek/");
  const isBakeryWorkArea =
    (pathname === "/bakkerij" || pathname.startsWith("/bakkerij/")) &&
    !isLogistiekWorkArea;
  const isWinkelWorkArea =
    pathname === "/winkel" ||
    pathname.startsWith("/winkel/") ||
    pathname.startsWith("/nieuws") ||
    pathname.startsWith("/strik-agenda") ||
    pathname.startsWith("/info") ||
    pathname.startsWith("/bruidstaarten") ||
    pathname === "/schoonmaak" ||
    pathname.startsWith("/schoonmaak/");
  const isWorkArea = isWinkelWorkArea || isBakeryWorkArea || isLogistiekWorkArea;
  const isVierdaagseWorkArea =
    pathname === "/vierdaagse" ||
    pathname.startsWith("/vierdaagse/") ||
    pathname === "/kraamrekenaar";
  const isSinterklaasWorkArea =
    pathname === "/sinterklaas" || pathname.startsWith("/sinterklaas/");

  if (isAuthArea || isPrintArea) {
    return <>{children}</>;
  }

  return (
    <>
      <NotificationMonitor />
      <LogoutButton profile={profile} />
      <div className="min-h-dvh bg-[#faf8f5]">
        <div className="flex min-h-dvh flex-row">
          <WinkelSidebar
            profile={profile}
            featureVisibility={featureVisibility}
          />

          <main
            className={`flex-1 overflow-auto ${
              isWorkArea || isVierdaagseWorkArea || isSinterklaasWorkArea
                ? "pb-32 md:pb-0"
                : "pb-24 md:pb-0"
            }`}
          >
            {children}
          </main>
        </div>
      </div>
      <BottomNav profile={profile} featureVisibility={featureVisibility} />
    </>
  );
}
