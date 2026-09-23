import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function authConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export async function createAuthClient() {
  if (!authConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items) { try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Read-only Server Component. */ } },
    },
  });
}

export async function authenticated() {
  const client = await createAuthClient();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser();
  return !error && user ? { client, user } : null;
}
