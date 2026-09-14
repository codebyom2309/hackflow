import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import TopNav from "@/components/layout/TopNav";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "HackFlow — Run Your Hackathon",
  description:
    "The complete operating system for conducting physical, in-person hackathons. Registration, desk allocation, QR check-in, judging, scoring, and certificates — all in one platform.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="night" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <TopNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
