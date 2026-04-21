import Link from "next/link";
import Image from "next/image";

const t = {
  en: {
    heroTitle: "GoviHub Spices",
    heroSubtitle:
      "Learn how GoviHub connects spice farmers to fair markets through AI",
    ytText: "Watch training videos on our YouTube channel",
    sectionGuides: "USER GUIDES",
    farmerTitle: "Farmer Guide",
    farmerDesc:
      "Complete guide to selling your spice harvest, AI crop diagnosis, weather alerts, farm advisory, and connecting with buyers. Everything a farmer needs to get started.",
    farmerTag: "FREE for all farmers",
    buyerTag: "FREE for all buyers",
    supplierTag: "FREE for all suppliers",
    buyerTitle: "Buyer Guide",
    buyerDesc:
      "How to find reliable spice farmers, post demand requirements, manage matches, and build your procurement network through GoviHub.",
    supplierTitle: "Supplier Guide",
    supplierDesc:
      "List your seeds, fertilizers, and farming equipment. Reach thousands of farmers browsing the GoviHub supply marketplace.",
    sectionFeatures: "KEY FEATURES",
    f1Title: "Smart Matching",
    f1Desc:
      "AI pairs farmers with buyers by crop, distance, quantity & timing",
    f2Title: "Crop Diagnosis",
    f2Desc:
      "Photo \u2192 AI identifies disease + treatment in Sinhala in 10 seconds",
    f3Title: "Weather Alerts",
    f3Desc:
      "5-day forecast with soil data + crop-specific automatic alerts",
    f4Title: "Farm Advisory",
    f4Desc:
      "595 Sri Lankan agricultural articles \u2014 ask anything in Sinhala",
    videoTitle: "\uD83D\uDCFA Watch: GoviHub Spices Introduction",
    videoDesc: "See how GoviHub works in 3 minutes",
    ctaStart: "Get Started \u2014 Free",
    ctaYt: "YouTube Channel",
    comingSoon: "Coming soon",
    langSwitch: "\u0DC3\u0DD2\u0D82\u0DC4\u0DBD",
  },
  si: {
    heroTitle: "GoviHub Spices",
    heroSubtitle:
      "GoviHub \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DB1\u0DCA \u0DC3\u0DCF\u0DB0\u0DCF\u0DBB\u0DAB \u0DC0\u0DD9\u0DC5\u0DAF\u0DB4\u0DDC\u0DC5\u0DA7 AI \u0DB8\u0D9C\u0DD2\u0DB1\u0DCA \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0D9A\u0DBB\u0DB1 \u0D86\u0D9A\u0DCF\u0DBB\u0DBA \u0DAF\u0DD0\u0DB1\u0D9C\u0DB1\u0DCA\u0DB1",
    ytText:
      "\u0D85\u0DB4\u0D9C\u0DD9 YouTube \u0DB1\u0DCF\u0DBD\u0DD2\u0D9A\u0DCF\u0DC0\u0DD9 \u0DB4\u0DD4\u0DC4\u0DD4\u0DAB\u0DD4 \u0DC0\u0DD3\u0DA9\u0DD2\u0DBA\u0DDD \u0DB1\u0DBB\u0DB6\u0DB1\u0DCA\u0DB1",
    sectionGuides:
      "\u0DB7\u0DCF\u0DC0\u0DD2\u0DAD\u0DCF \u0DB8\u0DCF\u0DBB\u0DCA\u0D9C\u0DDD\u0DB4\u0DAF\u0DD9\u0DC1",
    farmerTitle:
      "\u0D9C\u0DDC\u0DC0\u0DD2 \u0DB8\u0DCF\u0DBB\u0DCA\u0D9C\u0DDD\u0DB4\u0DAF\u0DD9\u0DC1\u0DBA",
    farmerDesc:
      "\u0D94\u0DB6\u0DD9 \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1 \u0DC0\u0DD2\u0D9A\u0DD2\u0DAB\u0DD3\u0DB8, AI \u0DB6\u0DDD\u0D9C \u0DBB\u0DDD\u0D9C \u0DC0\u0DD2\u0DB1\u0DD2\u0DC1\u0DCA\u0DA0\u0DBA, \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0D85\u0DB1\u0DAD\u0DD4\u0DBB\u0DD4 \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA, \u0D9C\u0DDC\u0DC0\u0DD2\u0DAD\u0DD0\u0DB1\u0DCA \u0D89\u0DB4\u0DAF\u0DD9\u0DC1\u0D9A, \u0DC3\u0DC4 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0DC3\u0DB8\u0D9F \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0DC0\u0DD3\u0DB8 \u0DB4\u0DD2\u0DC5\u0DD2\u0DB6\u0DAF \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0DB8\u0DCF\u0DBB\u0DCA\u0D9C\u0DDD\u0DB4\u0DAF\u0DD9\u0DC1\u0DBA.",
    farmerTag:
      "\u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DB1\u0DCA\u0DA7 \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB\u0DBA\u0DD9\u0DB1\u0DCA\u0DB8 \u0DB1\u0DDC\u0DB8\u0DD2\u0DBD\u0DD9",
    buyerTag:
      "\u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0DA7 \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB\u0DBA\u0DD9\u0DB1\u0DCA\u0DB8 \u0DB1\u0DDC\u0DB8\u0DD2\u0DBD\u0DD9",
    supplierTag:
      "\u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0DA7 \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB\u0DBA\u0DD9\u0DB1\u0DCA\u0DB8 \u0DB1\u0DDC\u0DB8\u0DD2\u0DBD\u0DD9",
    buyerTitle:
      "\u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4 \u0DB8\u0DCF\u0DBB\u0DCA\u0D9C\u0DDD\u0DB4\u0DAF\u0DD9\u0DC1\u0DBA",
    buyerDesc:
      "\u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DCF\u0DC3\u0DAF\u0DCF\u0DBA\u0D9A \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DB1\u0DCA \u0DC3\u0DDC\u0DBA\u0DCF \u0D9C\u0DB1\u0DCA\u0DB1\u0DD9 \u0D9A\u0DD9\u0DC3\u0DD9\u0DAF, \u0D89\u0DBD\u0DCA\u0DBD\u0DD4\u0DB8\u0DCA \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA\u0DAD\u0DCF \u0DB4\u0DC5 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1\u0DD9 \u0D9A\u0DD9\u0DC3\u0DD9\u0DAF, \u0DC3\u0DC4 \u0D94\u0DB6\u0DD9 \u0DB4\u0DCA\u200D\u0DBB\u0DC3\u0DB8\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0DA2\u0DCF\u0DBD\u0DBA \u0D9C\u0DDC\u0DA9\u0DB1\u0D9F\u0DCF \u0D9C\u0DB1\u0DCA\u0DB1\u0DD9 \u0D9A\u0DD9\u0DC3\u0DD9\u0DAF.",
    supplierTitle:
      "\u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4 \u0DB8\u0DCF\u0DBB\u0DCA\u0D9C\u0DDD\u0DB4\u0DAF\u0DD9\u0DC1\u0DBA",
    supplierDesc:
      "\u0D94\u0DB6\u0DD9 \u0DB6\u0DD3\u0DA2, \u0DB4\u0DDC\u0DC4\u0DDC\u0DBB, \u0DC3\u0DC4 \u0D9C\u0DDC\u0DC0\u0DD2\u0DAD\u0DD0\u0DB1\u0DCA \u0D89\u0DB4\u0D9A\u0DBB\u0DAB \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0D9C\u0DAD \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1. GoviHub \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA \u0DC0\u0DD9\u0DC5\u0DAF\u0DB4\u0DDC\u0DC5 \u0DC3\u0DDC\u0DBA\u0DB1 \u0DAF\u0DC4\u0DC3\u0DCA \u0D9C\u0DAB\u0DB1\u0DCA \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DB1\u0DCA \u0DC0\u0DD9\u0DAD \u0DC5\u0D9F\u0DCF \u0DC0\u0DB1\u0DCA\u0DB1.",
    sectionFeatures:
      "\u0DB4\u0DCA\u200D\u0DBB\u0DB0\u0DCF\u0DB1 \u0DC0\u0DD2\u0DC1\u0DD9\u0DC2\u0DCF\u0D82\u0D9C",
    f1Title: "AI \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8",
    f1Desc:
      "\u0DB6\u0DDD\u0D9C\u0DBA, \u0DAF\u0DD4\u0DBB, \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA \u0DC3\u0DC4 \u0D9A\u0DCF\u0DBD\u0DBA \u0D85\u0DB1\u0DD4\u0DC0 \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DB1\u0DCA \u0DC4\u0DCF \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0DC3\u0DCA\u0DC0\u0DBA\u0D82\u0D9A\u0DCA\u200D\u0DBB\u0DD3\u0DBA\u0DC0 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD9",
    f2Title:
      "\u0DB6\u0DDD\u0D9C \u0DBB\u0DDD\u0D9C \u0DC0\u0DD2\u0DB1\u0DD2\u0DC1\u0DCA\u0DA0\u0DBA",
    f2Desc:
      "\u0DA1\u0DCF\u0DBA\u0DCF\u0DBB\u0DD6\u0DB4\u0DBA\u0D9A\u0DCA \u2192 AI \u0DAD\u0DAD\u0DCA\u0DB4\u0DBB 10\u0DB1\u0DCA \u0DBB\u0DDD\u0D9C\u0DBA + \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0D9A\u0DCF\u0DBB\u0DBA \u0DC3\u0DD2\u0D82\u0DC4\u0DBD\u0DD9\u0DB1\u0DCA \u0D9A\u0DD2\u0DBA\u0DB1\u0DC0\u0DCF",
    f3Title:
      "\u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0D85\u0DB1\u0DAD\u0DD4\u0DBB\u0DD4 \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA",
    f3Desc:
      "\u0DAF\u0DD2\u0DB1 5\u0D9A\u0DCA \u0D85\u0DB1\u0DCF\u0DC0\u0DD0\u0D9A\u0DD2\u0DBA + \u0DB4\u0DC3 \u0DAF\u0DAD\u0DCA\u0DAD + \u0DB6\u0DDD\u0D9C\u0DBA\u0DA7 \u0D85\u0DB1\u0DD4\u0D9A\u0DD6\u0DBD \u0DC3\u0DCA\u0DC0\u0DBA\u0D82 \u0D85\u0DB1\u0DAD\u0DD4\u0DBB\u0DD4 \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA",
    f4Title:
      "\u0D9C\u0DDC\u0DC0\u0DD2\u0DAD\u0DD0\u0DB1\u0DCA \u0D89\u0DB4\u0DAF\u0DD9\u0DC1\u0D9A",
    f4Desc:
      "\u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0D82\u0D9A\u0DCF \u0D9A\u0DD8\u0DC2\u0DD2\u0D9A\u0DBB\u0DCA\u0DB8 \u0DBD\u0DD2\u0DB4\u0DD2 595\u0D9A\u0DCA \u2014 \u0D95\u0DB1\u0DD0\u0DB8 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0D9A\u0DCA \u0DC3\u0DD2\u0D82\u0DC4\u0DBD\u0DD9\u0DB1\u0DCA \u0D85\u0DC4\u0DB1\u0DCA\u0DB1",
    videoTitle:
      "\uD83D\uDCFA \u0DB1\u0DBB\u0DB6\u0DB1\u0DCA\u0DB1: GoviHub Spices \u0DC4\u0DD0\u0DAF\u0DD2\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8",
    videoDesc:
      "GoviHub \u0D9A\u0DCA\u200D\u0DBB\u0DD2\u0DBA\u0DCF \u0D9A\u0DBB\u0DB1 \u0D86\u0D9A\u0DCF\u0DBB\u0DBA \u0DB8\u0DD2\u0DB1\u0DD2\u0DAD\u0DCA\u0DAD\u0DD4 3\u0DB1\u0DCA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1",
    ctaStart:
      "\u0DB1\u0DDC\u0DB8\u0DD2\u0DBD\u0DD9 \u0D86\u0DBB\u0DB8\u0DCA\u0DB7 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1",
    ctaYt: "YouTube \u0DB1\u0DCF\u0DBD\u0DD2\u0D9A\u0DCF\u0DC0",
    comingSoon: "Coming soon",
    langSwitch: "English",
  },
};

const YT_CHANNEL = "https://www.youtube.com/@GoviHubSriLanka";

export default function LearnPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params.locale || "en";
  const isSi = locale === "si";
  const txt = isSi ? t.si : t.en;
  const promoVideoId = process.env.NEXT_PUBLIC_PROMO_VIDEO_ID;

  const guides = [
    {
      emoji: "\uD83C\uDF31",
      title: txt.farmerTitle,
      desc: txt.farmerDesc,
      tag: txt.farmerTag,
      href: `/${locale}/learn/farmer-guide`,
      available: true,
    },
    {
      emoji: "\uD83C\uDFEA",
      title: txt.buyerTitle,
      desc: txt.buyerDesc,
      tag: txt.buyerTag,
      href: `/${locale}/learn/buyer-guide`,
      available: true,
    },
    {
      emoji: "\uD83D\uDCE6",
      title: txt.supplierTitle,
      desc: txt.supplierDesc,
      tag: txt.supplierTag,
      href: `/${locale}/learn/supplier-guide`,
      available: true,
    },
  ];

  const features = [
    { emoji: "\uD83E\uDD1D", title: txt.f1Title, desc: txt.f1Desc },
    { emoji: "\uD83D\uDD2C", title: txt.f2Title, desc: txt.f2Desc },
    { emoji: "\uD83C\uDF26\uFE0F", title: txt.f3Title, desc: txt.f3Desc },
    { emoji: "\uD83D\uDCDA", title: txt.f4Title, desc: txt.f4Desc },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ── Hero ── */}
      <section
        className="relative px-4 py-12 sm:py-16 text-center text-white"
        style={{
          background: "linear-gradient(135deg, #1B5E20 0%, #2D6A2E 100%)",
        }}
      >
        <div className="mx-auto max-w-3xl">
          <Image
            src="/images/logo-icon-sm.png"
            alt="GoviHub"
            width={72}
            height={72}
            className="mx-auto mb-4 rounded-full"
          />
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {txt.heroTitle}
          </h1>
          <p className="mt-3 text-base sm:text-lg text-green-100 max-w-xl mx-auto leading-relaxed">
            {txt.heroSubtitle}
          </p>

          {/* Language toggle */}
          <div className="mt-6 flex items-center justify-center gap-3 text-sm">
            <Link
              href="/en/learn"
              className={`px-3 py-1 rounded-full transition ${
                !isSi
                  ? "bg-white/20 font-semibold"
                  : "bg-white/10 hover:bg-white/15"
              }`}
            >
              English
            </Link>
            <Link
              href="/si/learn"
              className={`px-3 py-1 rounded-full transition ${
                isSi
                  ? "bg-white/20 font-semibold"
                  : "bg-white/10 hover:bg-white/15"
              }`}
            >
              {"\u0DC3\u0DD2\u0D82\u0DC4\u0DBD"}
            </Link>
          </div>
        </div>
      </section>

      {/* ── YouTube Banner ── */}
      <a
        href={YT_CHANNEL}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        style={{ backgroundColor: "#1A1A2E" }}
      >
        <div className="mx-auto max-w-4xl flex items-center justify-center gap-3 px-4 py-3 text-white text-sm sm:text-base">
          {/* YouTube play icon */}
          <span
            className="inline-flex items-center justify-center flex-shrink-0 rounded"
            style={{
              width: 28,
              height: 20,
              backgroundColor: "#FF0000",
            }}
          >
            <span
              className="block"
              style={{
                width: 0,
                height: 0,
                borderTop: "5px solid transparent",
                borderBottom: "5px solid transparent",
                borderLeft: "8px solid white",
                marginLeft: 2,
              }}
            />
          </span>
          <span>{txt.ytText}</span>
          <span
            className="font-semibold"
            style={{ color: "#E8A838" }}
          >
            @GoviHubSriLanka
          </span>
        </div>
      </a>

      {/* ── Guide Cards ── */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-6 text-center">
          {txt.sectionGuides}
        </h2>

        <div className="grid gap-5 sm:grid-cols-3">
          {guides.map((g) => {
            const inner = (
              <div
                className={`bg-white border border-gray-200 rounded-xl p-5 text-center transition ${
                  g.available
                    ? "hover:shadow-lg hover:border-green-300 cursor-pointer"
                    : "opacity-80"
                }`}
              >
                <span className="text-4xl">{g.emoji}</span>
                <h3 className="mt-3 text-lg font-semibold text-gray-900">
                  {g.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {g.desc}
                </p>
                {g.tag && (
                  <span
                    className="inline-block mt-3 text-xs font-semibold px-3 py-1 rounded-full text-white"
                    style={{ backgroundColor: "#2D6A2E" }}
                  >
                    {g.tag}
                  </span>
                )}
                {!g.available && (
                  <span className="inline-block mt-3 text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-500">
                    {txt.comingSoon}
                  </span>
                )}
              </div>
            );

            return g.available && g.href ? (
              <Link key={g.title} href={g.href} className="block">
                {inner}
              </Link>
            ) : (
              <div key={g.title}>{inner}</div>
            );
          })}
        </div>
      </section>

      {/* ── Feature Grid ── */}
      <section className="mx-auto max-w-4xl px-4 pb-10 sm:pb-14">
        <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-6 text-center">
          {txt.sectionFeatures}
        </h2>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4 hover:shadow-md transition"
            >
              <span className="text-3xl flex-shrink-0">{f.emoji}</span>
              <div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Video Placeholder ── */}
      <section className="mx-auto max-w-4xl px-4 pb-10 sm:pb-14">
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "2px solid #E8A838" }}
        >
          <div className="px-5 py-3" style={{ backgroundColor: "#1A1A2E" }}>
            <h3 className="text-white font-semibold text-center">
              {txt.videoTitle}
            </h3>
            <p className="text-gray-400 text-sm text-center mt-1">
              {txt.videoDesc}
            </p>
          </div>

          {promoVideoId ? (
            <div className="relative w-full" style={{ paddingTop: "177.78%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${promoVideoId}`}
                title="GoviHub Promo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex items-center justify-center bg-gray-100 py-16 sm:py-24">
              <p className="text-gray-400 text-sm">
                {isSi
                  ? "\u0DC0\u0DD3\u0DA9\u0DD2\u0DBA\u0DDD\u0DC0 \u0DB8\u0DD9\u0DC4\u0DD2\u0DAF\u0DD3 \u0D91\u0D9A\u0DAD\u0DD4 \u0DC0\u0DD9\u0DBA\u0DD2"
                  : "Video coming soon"}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-4xl px-4 pb-12 sm:pb-16 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href={`/${locale}/auth/beta-login`}
          className="inline-block px-8 py-3 rounded-lg font-semibold text-white text-center transition hover:opacity-90"
          style={{ backgroundColor: "#E8A838" }}
        >
          {txt.ctaStart}
        </Link>
        <a
          href={YT_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-3 rounded-lg font-semibold text-white text-center transition hover:opacity-90"
          style={{ backgroundColor: "#2D6A2E" }}
        >
          {txt.ctaYt}
        </a>
      </section>

      {/* ── Footer ── */}
      <footer
        className="px-4 py-8 text-center text-sm"
        style={{ backgroundColor: "#1A1A2E", color: "#9CA3AF" }}
      >
        <Image
          src="/images/logo-icon-sm.png"
          alt="GoviHub"
          width={40}
          height={40}
          className="mx-auto mb-3 rounded-full opacity-80"
        />
        <p className="font-semibold text-white">GoviHub Spices</p>
        <p className="mt-1">
          {isSi ? "AiGNITE \u0DB8\u0D9C\u0DD2\u0DB1\u0DCA \u0DC3\u0D9A\u0DC3\u0DCA" : "Powered by AiGNITE"}
        </p>
        <a
          href={YT_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 hover:text-white transition"
          style={{ color: "#E8A838" }}
        >
          @GoviHubSriLanka
        </a>
      </footer>
    </main>
  );
}
