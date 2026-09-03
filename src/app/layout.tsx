import type { Metadata } from "next";
import { Golos_Text, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const golos = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SPEC CHECK PRO — анализ технических заданий",
  description:
    "Загрузите ТЗ и получите документ с подсвеченными местами и комментариями HIGH / MEDIUM / LOW.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${golos.variable} ${jetbrains.variable} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
