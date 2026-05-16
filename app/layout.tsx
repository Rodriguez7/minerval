import "./globals.css";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { I18nProvider } from "@/lib/i18n/client";
import { getRequestLocale, getRequestMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getRequestMessages();

  return {
    title: messages.meta.title,
    description: messages.meta.description,
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
