/** Neutral product illustration used when a catalog item has no image (never implies a real product photo). */
export function DiaperIllustration() {
  return <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <path d="M14 30c0-5 4-9 9-9h54c5 0 9 4 9 9v8c0 22-14 41-36 41S14 60 14 38z" fill="#fff" stroke="currentColor" strokeWidth="3" strokeOpacity=".45" />
    <path d="M14 36h72" stroke="currentColor" strokeWidth="3" strokeOpacity=".3" />
    <circle cx="38" cy="54" r="4" fill="currentColor" opacity=".35" />
    <circle cx="62" cy="54" r="4" fill="currentColor" opacity=".35" />
  </svg>;
}
