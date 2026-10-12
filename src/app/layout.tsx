import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        {children}
        <footer className="px-6 py-4 text-center text-sm text-zinc-500">
          {strings.footer}
        </footer>
      </body>
    </html>
  );
}
