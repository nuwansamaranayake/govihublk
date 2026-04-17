import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import FeedbackFAB from "@/components/ui/FeedbackFAB";
import "../globals.css";

export const metadata = {
  title: "GoviHub Spices — Sri Lanka's AI Farming Marketplace",
  description:
    "Direct connections between spice farmers, buyers, and suppliers in Sri Lanka. Sinhala-first. AI-powered crop diagnosis, weather alerts, advisory.",
  manifest: "/manifest.json",
  themeColor: "#2D6A2E",
  appleWebApp: {
    capable: true,
    title: "GoviHub Spices",
    statusBarStyle: "default" as const,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "GoviHub Spices — Sri Lanka's AI Farming Marketplace",
    description:
      "Direct connections between spice farmers, buyers, and suppliers in Sri Lanka.",
    images: ["/images/og-image.jpg"],
  },
};

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --govihub-green-dark: #1B5E20;
                --govihub-green: #2D6A2E;
                --govihub-gold: #E8A838;
              }
            `,
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <ToastProvider>
              {children}
              <FeedbackFAB />
            </ToastProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
