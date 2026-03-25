import { useTranslations } from "next-intl";
import Link from "next/link";

export default function HomePage() {
  const t = useTranslations("home");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-primary-500">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-600 text-white text-3xl font-bold mb-6 shadow-lg">
        GH
      </div>
      <h1 className="text-5xl font-bold text-white">{t("heroTitle")}</h1>
      <p className="mt-4 text-xl text-primary-100">{t("heroSubtitle")}</p>
      <Link href="/auth/beta-login">
        <button className="mt-8 rounded-lg bg-accent-500 px-8 py-3 text-lg font-semibold text-white hover:bg-accent-600 transition-colors">
          {t("getStarted")}
        </button>
      </Link>
    </main>
  );
}
