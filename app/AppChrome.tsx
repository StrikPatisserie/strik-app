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
  const isPublicCampaign =
    pathname === "/sint-voor-bedrijven" ||
    pathname === "/kerst-voor-bedrijven" ||
    pathname === "/lettershop" ||
    pathname === "/menu-preview";
  const isWelcomeArea = pathname === "/";

  if (isAuthArea || isPrintArea || isPublicCampaign) {
    return <>{children}</>;
  }

  return (
    <>
      <NotificationMonitor />
      <LogoutButton profile={profile} />
      <div className={`min-h-dvh ${isWelcomeArea ? "bg-[#d8e2d4]" : "bg-[#c3d3bc]"}`}>
        <div className="flex min-h-dvh flex-row">
          <WinkelSidebar
            profile={profile}
            featureVisibility={featureVisibility}
          />

          <main
            className={`relative z-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-24 md:pb-0 ${isWelcomeArea ? "bg-[#c3d3bc]" : ""}`}
          >
            {children}
          </main>
        </div>
      </div>
      <BottomNav profile={profile} featureVisibility={featureVisibility} />
    </>
  );
}
