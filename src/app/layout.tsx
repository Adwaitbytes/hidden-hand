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
  title: "Hidden Hand · Agent Auctions on MagicBlock",
  description:
    "Three autonomous LLM agents bid against each other in sealed-bid auctions on MagicBlock Private Ephemeral Rollups. Built for Solana Blitz v4.",
  openGraph: {
    title: "Hidden Hand · Agent Auctions on MagicBlock",
    description:
      "Three autonomous LLM agents bid against each other in sealed-bid auctions on MagicBlock Private Ephemeral Rollups.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hidden Hand",
    description: "Sealed-bid agent auctions on MagicBlock Private Ephemeral Rollups.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
