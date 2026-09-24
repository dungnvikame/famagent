import { ImageResponse } from "next/og";

// iOS home-screen icon (PNG; iOS ignores SVG icons) — needed there before Web Push can be enabled.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #7a5cff, #5b4bb7)", color: "#fff", fontSize: 92, fontWeight: 800 }}>F</div>, size);
}
