import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const fontSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const fontMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Sentinel Intelligence", template: "%s · Sentinel Intelligence" },
  description: "Piattaforma OSINT, Cyber Threat Intelligence e Digital Investigations.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0d141c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
