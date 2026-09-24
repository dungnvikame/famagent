import type { MetadataRoute } from "next";

/** Installable FamAgent (Add to Home Screen); required on iOS for Web Push reminders. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FamAgent — gia đình vận hành nhẹ nhàng hơn",
    short_name: "FamAgent",
    description: "Tiền, mua sắm và chăm con của nhà mình ở một chỗ.",
    start_url: "/home",
    display: "standalone",
    background_color: "#f7f6fb",
    theme_color: "#5b4bb7",
    lang: "vi",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
