// Stroke icons for the 5 main sections (24px grid, 1.8 stroke) — same family as onboarding/icons.tsx.
type IconProps = { size?: number };
const base = (size = 22) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const IconHome = ({ size }: IconProps) => <svg {...base(size)}><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></svg>;
export const IconMoney = ({ size }: IconProps) => <svg {...base(size)}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M8 15h3" /></svg>;
export const IconBag = ({ size }: IconProps) => <svg {...base(size)}><path d="M6 8h12l1 12H5z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>;
export const IconAgent = ({ size }: IconProps) => <svg {...base(size)}><path d="M12 3v3M5 9l-2 1M19 9l2 1" /><rect x="5" y="8" width="14" height="11" rx="4" /><circle cx="10" cy="13" r="1" /><circle cx="14" cy="13" r="1" /></svg>;
export const IconFamily = ({ size }: IconProps) => <svg {...base(size)}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 20a3.5 3.5 0 0 1 6.5-2" /></svg>;
export const IconPlus = ({ size }: IconProps) => <svg {...base(size)} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>;
export const IconChevron = ({ size }: IconProps) => <svg {...base(size)}><path d="m9 6 6 6-6 6" /></svg>;
export const IconMenu = ({ size }: IconProps) => <svg {...base(size)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
