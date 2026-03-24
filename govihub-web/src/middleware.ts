import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["si", "en", "ta"],
  defaultLocale: "si",
  localePrefix: "always",
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
