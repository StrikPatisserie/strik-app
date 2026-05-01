import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "./BottomNav";
import NotificationMonitor from "./NotificationMonitor";

export const metadata: Metadata = {
  title: "Strik Personeelsapp",
  description: "Interne app voor Strik Patisserie",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>
        <NotificationMonitor />
        <div className="pb-24">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
