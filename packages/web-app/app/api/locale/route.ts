import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { locale?: string };
  const locale = isAppLocale(body.locale) ? body.locale : DEFAULT_LOCALE;
  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}
