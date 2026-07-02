import type { Metadata } from "next";
import { Manrope, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const heading = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
// Noto Sans TC 走 <link>（Next 16 Turbopack 目前無法解析 next/font 的 CJK 變體
// 字體，會噴 internal/font/google/font module-not-found）。--font-tc 於
// globals.css :root 定義，body/heading 都以它作為中文 fallback。

export const metadata: Metadata = {
  title: "CryptoSense · 加密貨幣風險研究助手",
  description:
    "進場前的風險與盲點提醒：整合即時行情、新聞情緒與個人知識庫的 AI 研究助手。非投資建議。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${sans.variable} ${heading.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <TopBar />
        {children}
      </body>
    </html>
  );
}
