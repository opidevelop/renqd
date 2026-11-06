import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://renqd.vercel.app"),
  title: {
    default: "Renqd — Rank. Compare. Share.",
    template: "%s | Renqd",
  },
  description:
    "Crea classifiche su tutto ciò che ti appassiona. Confronta le tue scelte e condividi il tuo punto di vista.",
  applicationName: "Renqd",
  openGraph: {
    type: "website",
    siteName: "Renqd",
    title: "Renqd — Rank. Compare. Share.",
    description:
      "Le tue idee, in ordine. Crea, confronta e condividi classifiche.",
    locale: "it_IT",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
