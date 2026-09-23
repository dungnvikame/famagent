// Persists a validated FamilyProfile for the signed-in (email or anonymous) Supabase user.
import type { SupabaseClient } from "@supabase/supabase-js";
import { childRow, familyRow } from "./profile-mapper.ts";
import type { FamilyProfile } from "./types.ts";

export type SaveProfileError = "family" | "children_read" | "children_write" | "children_delete";

/** Upserts family_profiles + children and removes children no longer in the profile. Returns an error code or null. */
export async function saveProfileForUser(client: SupabaseClient, userId: string, profile: FamilyProfile, now = new Date().toISOString()): Promise<SaveProfileError | null> {
  const { data: family, error } = await client.from("family_profiles").upsert(familyRow(profile, userId, now), { onConflict: "user_id" }).select("id").single();
  if (error || !family) return "family";
  const { data: existing, error: readError } = await client.from("children").select("id").eq("family_profile_id", family.id);
  if (readError) return "children_read";
  const childIds = profile.children.map((child) => /^[a-f0-9-]{36}$/i.test(child.id) ? child.id : crypto.randomUUID());
  if (profile.children.length) {
    const { error: childError } = await client.from("children").upsert(profile.children.map((child, index) => childRow({ ...child, id: childIds[index] }, family.id, index, now)));
    if (childError) return "children_write";
  }
  const removed = (existing ?? []).map((child) => child.id as string).filter((id) => !childIds.includes(id));
  if (removed.length) {
    const { error: removeError } = await client.from("children").delete().eq("family_profile_id", family.id).in("id", removed);
    if (removeError) return "children_delete";
  }
  return null;
}
