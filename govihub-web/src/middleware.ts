import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware({
  locales: ["si", "en", "ta"],
  defaultLocale: "si",
  localePrefix: "always",
});

const protectedPrefixes = ["/farmer/", "/buyer/", "/supplier/", "/admin/"];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route (strip locale prefix first)
  const pathWithoutLocale = pathname.replace(/^\/(en|si|ta)/, "");
  const isProtected = protectedPrefixes.some(p => pathWithoutLocale.startsWith(p));

  if (isProtected) {
    // Check for token cookie
    const token = request.cookies.get("govihub_token")?.value;
    if (!token) {
      const locale = pathname.split("/")[1] || "en";
      const loginUrl = new URL(`/${locale}/auth/beta-login`, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
