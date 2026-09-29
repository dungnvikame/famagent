// What family notes add to a chat reply (SPEC_V2 §31), for every turn type: notes recorded from this message,
// unconfirmed health notes that name a brand (recorded, not applied), and a caveat when notes could not be loaded.
import type { ChatResponse } from "../experience/types.ts";
import { NOTES_UNAVAILABLE_REPLY, unconfirmedNoteReply, type FamilyNote, type NoteCandidate } from "./notes.ts";

export interface NoteSignals {
  /** Notes stored from this message. */
  recorded: NoteCandidate[];
  /** Notes loaded for the family; null when loading failed (signed-in users only). */
  existing: FamilyNote[] | null;
  /** Signed-in user whose notes could not be checked: brand avoidance was not applied. */
  unavailable: boolean;
}

export function applyNoteSignals(response: ChatResponse, { recorded, existing, unavailable }: NoteSignals): ChatResponse {
  const extras: string[] = [];
  // A health note just recorded is not applied until confirmed, so say so instead of filtering silently.
  const fresh = recorded.map((note): FamilyNote => ({ id: "", status: "recorded", createdAt: "", ...note }));
  // An older unconfirmed note counts when a recommended product is from that brand.
  const shown = new Set(response.recommendations.map((item) => item.product.brand.toLocaleLowerCase("vi")));
  const older = (existing ?? []).filter((note) => note.brand && shown.has(note.brand.toLocaleLowerCase("vi")));
  const reply = unconfirmedNoteReply([...fresh, ...older]);
  if (reply) extras.push(reply);
  if (unavailable && response.recommendations.length) extras.push(NOTES_UNAVAILABLE_REPLY);
  const text = extras.length ? `${response.text} ${extras.join(" ")}`.trim() : response.text;
  return { ...response, text, ...(recorded.length ? { notesRecorded: recorded.map((note) => note.text) } : {}) };
}
