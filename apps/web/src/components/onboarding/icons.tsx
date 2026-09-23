// One stroke-icon family (24px grid, 1.8 stroke) for onboarding UI; decorative unless given a title.
type IconProps = { size?: number };
const base = (size = 18) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const IconRuler = ({ size }: IconProps) => <svg {...base(size)}><rect x="2.5" y="8" width="19" height="8" rx="2" /><path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4" /></svg>;
export const IconWallet = ({ size }: IconProps) => <svg {...base(size)}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12.5h2M3 9h13a3 3 0 0 0 0-3H6" /></svg>;
export const IconPencil = ({ size }: IconProps) => <svg {...base(size)}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>;
export const IconShield = ({ size }: IconProps) => <svg {...base(size)}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>;
export const IconArrowUp = ({ size }: IconProps) => <svg {...base(size)} strokeWidth={2.2}><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
export const IconCheck = ({ size }: IconProps) => <svg {...base(size)} strokeWidth={2.2}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const IconSparkle = ({ size }: IconProps) => <svg {...base(size)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>;
