import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import WarmUp from "@/components/WarmUp";

export const metadata: Metadata = {
  title: {
    default: "Contexa",
    template: "%s · Contexa",
  },
  description:
    "Find people to work with, ranked by your profile and what you need right now, with the reasons behind every match.",
  applicationName: "Contexa",
  appleWebApp: {
    capable: true,
    title: "Contexa",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#eef0f5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader />
        <div id="main" className="flex flex-1 flex-col">
          {children}
        </div>
        <ServiceWorkerRegistration />
        <WarmUp />
      </body>
    </html>
  );
}
