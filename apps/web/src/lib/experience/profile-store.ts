// Persists a validated FamilyProfile for the signed-in (email or anonymous) Supabase user.
import type { SupabaseClient } from "@supabase/supabase-js";
import { childRow, familyRow } from "./profile-mapper.ts";
import type { FamilyProfile } from "./types.ts";

export type SaveProfileError = "family" | "children_read" | "children_write" | "children_delete";

/** VN calendar day of an ISO time (the weighing date for the growth chart). */
const vnDay = (iso?: string) => new Date((iso && !Number.isNaN(Date.parse(iso)) ? Date.parse(iso) : Date.now()) + 7 * 3_600_000).toISOString().slice(0, 10);

/**
 * Growth chart: a child's current weight becomes a weighing (dated when it was observed) whenever it differs from
 * the latest one logged — so chat and form updates both land on the chart. Best effort: a missing table
 * (migration 0021 not applied) or a failed write never fails the profile save.
 */
async function logWeights(client: SupabaseClient, userId: string, profile: FamilyProfile, childIds: string[]) {
  const weighed = profile.children.map((child, index) => ({ id: childIds[index], kg: child.weightKg, date: vnDay(profile.fieldMeta?.[`children.${child.id}.weightKg`]?.observedAt) })).filter((item): item is { id: string; kg: number; date: string } => item.kg !== undefined);
  if (!weighed.length) return;
  const { data, error } = await client.from("child_weights").select("child_id,measured_on,weight_kg").eq("user_id", userId).in("child_id", weighed.map((item) => item.id)).order("measured_on", { ascending: false });
  if (error) return;
  const latest = new Map<string, { date: string; kg: number }>();
  for (const row of data ?? []) if (!latest.has(row.child_id as string)) latest.set(row.child_id as string, { date: String(row.measured_on).slice(0, 10), kg: Number(row.weight_kg) });
  const rows = weighed.filter((item) => { const last = latest.get(item.id); return !last || (Math.abs(last.kg - item.kg) >= 0.05 && item.date >= last.date); })
    .map((item) => ({ user_id: userId, child_id: item.id, measured_on: item.date, weight_kg: Math.round(item.kg * 10) / 10 }));
  if (rows.length) await client.from("child_weights").upsert(rows, { onConflict: "child_id,measured_on" });
}

/** Upserts family_profiles + children and removes children no longer in the profile. Returns an error code or null. */
export async function saveProfileForUser(client: SupabaseClient, userId: string, profile: FamilyProfile, now = new Date().toISOString()): Promise<SaveProfileError | null> {
  const { data: family, error } = await client.from("family_profiles").upsert(familyRow(profile, userId, now), { onConflict: "user_id" }).select("id").single();
  if (error || !family) return "family";
  const { data: existing, error: readError } = await client.from("children").select("id").eq("family_profile_id", family.id);
  if (readError) return "children_read";
  const childIds = profile.children.map((child) => /^[a-f0-9-]{36}$/i.test(child.id) ? child.id : crypto.randomUUID());
  if (profile.children.length) {
    const rows = profile.children.map((child, index) => childRow({ ...child, id: childIds[index] }, family.id, index, now));
    let { error: childError } = await client.from("children").upsert(rows);
    // Migration 202609290019 (children.age_as_of) not applied yet: save without it; the age then stays as given.
    if (childError && /age_as_of/.test(childError.message)) ({ error: childError } = await client.from("children").upsert(rows.map((row) => { const copy = { ...row }; delete copy.age_as_of; return copy; })));
    // Same for migration 202609290022 (children.sex): the WHO chart then just asks again.
    if (childError && /\bsex\b/.test(childError.message)) ({ error: childError } = await client.from("children").upsert(rows.map((row) => { const copy = { ...row }; delete copy.sex; return copy; })));
    if (childError) return "children_write";
  }
  await logWeights(client, userId, profile, childIds);
  const removed = (existing ?? []).map((child) => child.id as string).filter((id) => !childIds.includes(id));
  if (removed.length) {
    const { error: removeError } = await client.from("children").delete().eq("family_profile_id", family.id).in("id", removed);
    if (removeError) return "children_delete";
  }
  return null;
}
