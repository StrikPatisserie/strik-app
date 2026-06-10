"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import NotificationMonitor from "./NotificationMonitor";

export default function AppChrome({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isBakeryEnvironment =
    pathname === "/bakkerij" || pathname.startsWith("/bakkerij/");

  return (
    <>
      <NotificationMonitor />
      <div
        className={`min-h-dvh bg-[#faf8f5] ${
          isBakeryEnvironment ? "" : "pb-24"
        }`}
      >
        {children}
      </div>
      {!isBakeryEnvironment && <BottomNav />}
    </>
  );
}
