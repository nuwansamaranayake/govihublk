import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import FeedbackFAB from "@/components/ui/FeedbackFAB";
import "../globals.css";

export const metadata = {
  title: "GoviHub - Smart Farming Marketplace",
  description:
    "AI-driven smart farming marketplace connecting farmers, buyers, and suppliers in Sri Lanka",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "GoviHub — Sri Lanka's AI Farming Marketplace",
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
