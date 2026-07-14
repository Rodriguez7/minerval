import "./globals.css";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { I18nProvider } from "@/lib/i18n/client";
import { getRequestLocale, getRequestMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getRequestMessages();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.minerval.org";

  return {
    metadataBase: new URL(appUrl),
    title: messages.meta.title,
    description: messages.meta.description,
    applicationName: "Minerval",
    category: "education",
    openGraph: {
      type: "website",
      siteName: "Minerval",
      title: messages.meta.title,
      description: messages.meta.description,
    },
    twitter: {
      card: "summary_large_image",
      title: messages.meta.title,
      description: messages.meta.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const messages = await getRequestMessages();

  return (
    <html lang={locale}>
      <body
        className="antialiased"
        style={
          {
            "--font-geist-sans":
              '"Inter", "Segoe UI", "Helvetica Neue", Arial, system-ui, sans-serif',
            "--font-geist-mono":
              '"SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
          } as CSSProperties
        }
      >
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
