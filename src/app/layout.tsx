import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const ibm = IBM_Plex_Mono({
  variable: "--font-ibm",
  weight: ["400", "500"],
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "SpecCheck — ревью ТЗ NET",
  description:
    "Предварительное ревью технических заданий на потоки и витрины данных.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${manrope.variable} ${ibm.variable} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
