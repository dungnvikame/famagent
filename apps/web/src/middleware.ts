import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPath = /^\/(home|money|shopping|agent|family|shop|products|compare|saved|go)(\/|$)/;

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return protectedPath.test(request.nextUrl.pathname) && request.cookies.get("family-ai-onboarded")?.value !== "1"
      ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (protectedPath.test(request.nextUrl.pathname) && (!user || user.is_anonymous)) {
    // Registration is mandatory: guests finish onboarding, then confirm an email before any advice/catalog page.
    const onboarded = request.cookies.get("family-ai-onboarded")?.value === "1";
    const target = !user ? "/sign-in" : onboarded ? "/sign-in?after=onboarding" : "/onboarding";
    const redirect = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach(({ name, value }) => redirect.cookies.set(name, value));
    return redirect;
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
