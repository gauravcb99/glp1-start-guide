import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { WhoopDataProvider } from "@/components/WhoopDataProvider";
import { strings } from "@/copy/strings";
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
  title: strings.appName,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WhoopDataProvider>
          {/* The header reads ?demo=, so it renders on the client inside Suspense. */}
          <Suspense fallback={<div className="h-12 border-b border-border" />}>
            <AppHeader />
          </Suspense>
          <div className="flex flex-1 flex-col">{children}</div>
        </WhoopDataProvider>
        <footer className="px-4 py-6 text-center text-sm text-muted">{strings.footer}</footer>
      </body>
    </html>
  );
}
