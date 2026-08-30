import type { Metadata } from "next";
import { Space_Grotesk, Inter, Geist_Mono } from "next/font/google";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/config";
import { LocaleProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

// Display face: an edgy grotesque for headlines and the wordmark.
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

// Body face: neutral, authoritative. CJK falls back to system stacks
// declared in globals.css, selected by the html lang attribute.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${SERVICE_NAME} — ${SERVICE_TAGLINE}`,
  description:
    "Keep what is true about your business — logo, color, type, voice, proof — in one place, with sources and confidence, and let your landing pages, videos and AI agents read from it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
