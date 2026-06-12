import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const monoplex = localFont({
  src: "../public/fonts/MonoplexKR-Italic.ttf",
  variable: "--font-jua",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "PhotoBooth",
  description: "Y2K 프리쿠라 감성 포토부스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${monoplex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}
