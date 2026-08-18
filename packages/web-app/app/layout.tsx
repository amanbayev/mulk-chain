import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { Providers } from "./providers";
import { DEFAULT_LOCALE, isAppLocale } from "@/lib/i18n/config";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mülk Chain",
    template: "%s · Mülk Chain",
  },
  description: "Institutional RWA market infrastructure for AIFC commercial real estate.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookie = cookies().get("NEXT_LOCALE")?.value;
  const locale = isAppLocale(cookie) ? cookie : DEFAULT_LOCALE;
  const messages = (await import(`../messages/${locale}.json`)).default;

  return (
    <html lang={locale} suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Almaty">
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
