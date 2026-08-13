import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppChrome from "./AppChrome";
import AutoUpdateRefresh from "./AutoUpdateRefresh";
import { getCurrentProfile } from "./lib/auth/session";
import { getFeatureVisibilitySettings } from "./lib/appSettings";
import { getAppVersion } from "./lib/appVersion";

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
  themeColor: "#faf8f5",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [profile, featureVisibility] = await Promise.all([
    getCurrentProfile(),
    getFeatureVisibilitySettings(),
  ]);
  const appVersion = getAppVersion();

  return (
    <html lang="nl" className="bg-[#faf8f5]">
      <body className="min-h-dvh bg-[#faf8f5] text-[#1a1815]">
        <AutoUpdateRefresh currentVersion={appVersion} />
        <AppChrome profile={profile} featureVisibility={featureVisibility}>
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
