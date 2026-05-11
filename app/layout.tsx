import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "./BottomNav";
import NotificationMonitor from "./NotificationMonitor";

export const metadata: Metadata = {
  title: "Strik Team app",
  description: "Interne app voor Strik Patisserie",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Strik",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f0ea",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="bg-[#f4f0ea]">
      <body className="min-h-dvh bg-[#f4f0ea] text-[#2d2a26]">
        <NotificationMonitor />
        <div className="min-h-dvh bg-[#f4f0ea] pb-24">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
