import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

export default function HomePage({ params }: { params: { locale: string } }) {
  const t = useTranslations("home");
  const locale = params.locale || "en";

  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.997M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      title: t("featureMatchTitle"),
      desc: t("featureMatchDesc"),
      color: "from-green-500 to-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      ),
      title: t("featureAssistTitle"),
      desc: t("featureAssistDesc"),
      color: "from-amber-500 to-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      ),
      title: t("featureSupplyTitle"),
      desc: t("featureSupplyDesc"),
      color: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
    },
  ];

  const steps = [
    { num: "01", title: t("step1Title"), desc: t("step1Desc"), icon: "📝" },
    { num: "02", title: t("step2Title"), desc: t("step2Desc"), icon: "🌾" },
    { num: "03", title: t("step3Title"), desc: t("step3Desc"), icon: "🤖" },
    { num: "04", title: t("step4Title"), desc: t("step4Desc"), icon: "💰" },
  ];

  return (
    <main className="min-h-screen">
      {/* ── Hero Section ──────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1B5E20] via-[#2D6A2E] to-[#1B5E20]">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        {/* Gold accent glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#E8A838] opacity-[0.06] blur-[120px]" />

        <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-3xl mx-auto">
          {/* Language Selector */}
          <div className="flex items-center gap-1 mb-8 bg-white/10 backdrop-blur-sm rounded-full px-1 py-1">
            <Link
              href="/si"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                locale === "si"
                  ? "bg-white text-green-800 shadow-md"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              🇱🇰 සිංහල
            </Link>
            <Link
              href="/en"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                locale === "en"
                  ? "bg-white text-green-800 shadow-md"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              🇬🇧 English
            </Link>
          </div>

          {/* Logo */}
          <div className="mb-8 drop-shadow-2xl">
            <Image
              src="/images/logo-full-dark.png"
              alt="GoviHub"
              width={400}
              height={160}
              priority
              className="w-[200px] sm:w-[280px] md:w-[400px] h-auto"
            />
          </div>

          {/* Bilingual tagline */}
          <div className="mb-8 space-y-1">
            <p className="text-[#E8A838] text-sm sm:text-base font-medium tracking-widest uppercase">
              Sri Lanka&apos;s AI Farming Marketplace
            </p>
            <p className="text-green-200/80 text-sm sm:text-base font-medium">
              ශ්‍රී ලංකාවේ AI ගොවිතැන් වෙළඳපොළ
            </p>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            {t("heroTitle")}
          </h1>
          <p className="text-base sm:text-lg text-green-100/80 max-w-xl leading-relaxed mb-10">
            {t("heroSubtitle")}
          </p>

          {/* CTA Button */}
          <Link href={`/${locale}/auth/beta-login`}>
            <button className="group relative px-10 py-4 bg-[#E8A838] hover:bg-[#C68A2E] text-white text-lg font-semibold rounded-2xl shadow-lg shadow-amber-900/30 transition-all duration-300 hover:shadow-xl hover:shadow-amber-900/40 hover:-translate-y-0.5">
              {t("getStarted")}
              <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">&rarr;</span>
            </button>
          </Link>

          {/* Scroll indicator */}
          <div className="mt-16 animate-bounce">
            <svg className="w-6 h-6 text-green-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Features Section ──────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-block px-4 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-medium mb-4">
              {locale === "si" ? "විශේෂාංග" : "Features"}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900">
              {locale === "si" ? "ඔබට අවශ්‍ය සියල්ල එක තැනක" : "Everything You Need in One Place"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className={`relative p-6 rounded-2xl border ${f.border} ${f.bg} hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${f.color} text-white mb-4 shadow-md`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">{f.title}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{f.desc}</p>
                {/* Gold accent line */}
                <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-[#E8A838]/40 to-transparent" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-neutral-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-block px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 text-sm font-medium mb-4">
              {t("howItWorks")}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900">
              {locale === "si" ? "පියවර 4කින් ආරම්භ කරන්න" : "Get Started in 4 Steps"}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative text-center p-6">
                {/* Step number */}
                <div className="text-5xl mb-3">{step.icon}</div>
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#2D6A2E] text-white text-xs font-bold mb-3">
                  {step.num}
                </div>
                <h3 className="text-base font-bold text-neutral-900 mb-1">{step.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{step.desc}</p>
                {/* Connector line */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-12 -right-3 w-6 border-t-2 border-dashed border-green-300" />
                )}
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div className="text-center mt-12">
            <Link href={`/${locale}/auth/beta-login`}>
              <button className="px-8 py-3 bg-[#2D6A2E] hover:bg-[#1B5E20] text-white font-semibold rounded-xl shadow-md transition-all duration-300 hover:shadow-lg">
                {t("getStarted")}
                <span className="ml-2">&rarr;</span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 bg-[#1B5E20] text-green-100">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Logo + brand */}
            <div className="flex items-center gap-3">
              <Image src="/images/logo-icon-sm.png" alt="GoviHub" width={36} height={36} className="rounded-lg" />
              <div>
                <p className="font-bold text-white">GoviHub</p>
                <p className="text-xs text-green-300">by AiGNITE</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">{t("footerAbout")}</a>
              <a href="#" className="hover:text-white transition-colors">{t("footerPrivacy")}</a>
              <a href="#" className="hover:text-white transition-colors">{t("footerTerms")}</a>
            </div>

            {/* Copyright */}
            <p className="text-xs text-green-300/70">
              &copy; 2026 GoviHub by AiGNITE
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
