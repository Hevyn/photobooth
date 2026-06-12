import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const meongi = localFont({
  src: "../public/fonts/Cafe24MeongiB.woff2",
  variable: "--font-bungee",
  display: "swap",
});

const mondangbunfil = localFont({
  src: "../public/fonts/Mondangbunfil.otf",
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
      className={`${meongi.variable} ${mondangbunfil.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}
