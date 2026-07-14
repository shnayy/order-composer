import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ORDER LINE｜15分オーダータイムライン",
  description:
    "待機時間と効果時間を持つオーダーを並べ、15分間の実行順と残り時間を組み立てるモバイルタイムライン。",
  applicationName: "ORDER LINE",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "ORDER LINE",
    description: "15分間のオーダーを、ひと目で組み立てる。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ORDER LINE" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ORDER LINE",
    description: "15分間のオーダーを、ひと目で組み立てる。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
