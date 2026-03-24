import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("home");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-primary-500">
      <h1 className="text-5xl font-bold text-white">{t("heroTitle")}</h1>
      <p className="mt-4 text-xl text-primary-100">{t("heroSubtitle")}</p>
      <button className="mt-8 rounded-lg bg-accent-500 px-8 py-3 text-lg font-semibold text-white hover:bg-accent-600 transition-colors">
        {t("getStarted")}
      </button>
    </main>
  );
}
