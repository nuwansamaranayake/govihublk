import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api/v1";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors from Google
  if (error) {
    return NextResponse.redirect(
      new URL(`/en/auth/login?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/en/auth/login?error=no_code", request.url)
    );
  }

  const redirectUri = `${new URL(request.url).origin}/api/auth/callback`;

  try {
    // Exchange code with backend
    const response = await fetch(`${API_BASE}/auth/google/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: redirectUri, state }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = (err as Record<string, string>).message || "auth_failed";
      return NextResponse.redirect(
        new URL(`/en/auth/login?error=${encodeURIComponent(msg)}`, request.url)
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      role?: string;
      is_profile_complete?: boolean;
      preferred_locale?: string;
    };

    const locale = data.preferred_locale || "en";

    // Determine redirect destination
    let destination: string;
    if (!data.is_profile_complete) {
      destination = `/${locale}/auth/register`;
    } else {
      const role = data.role || "farmer";
      destination = `/${locale}/${role}/dashboard`;
    }

    const redirectResponse = NextResponse.redirect(new URL(destination, request.url));

    // Forward any Set-Cookie headers from backend (refresh token httpOnly cookie)
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      redirectResponse.headers.set("set-cookie", setCookie);
    }

    // Store access token in a short-lived cookie so client JS can pick it up
    redirectResponse.cookies.set("govihub_at", data.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 15, // 15 minutes — client reads and moves to memory
      path: "/",
    });

    return redirectResponse;
  } catch (err) {
    console.error("[auth/callback] Error:", err);
    return NextResponse.redirect(
      new URL("/en/auth/login?error=server_error", request.url)
    );
  }
}
