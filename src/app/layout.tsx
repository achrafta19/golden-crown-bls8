import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "التاج الذهبي | حجز تأشيرة إسبانيا — الجزائر",
  description:
    "منصة محمية للحجز الآلي والسريع لتأشيرة إسبانيا في الجزائر عبر BLS International. توقيت جزائري، دقة عالية، وخصوصية كاملة.",
  applicationName: "Golden Crown BLS",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#070b18",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}