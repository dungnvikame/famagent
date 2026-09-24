import { redirect } from "next/navigation";

/** Legacy URL from the first MVP; the assistant now lives under /agent. */
export default function ShopPage() { redirect("/agent"); }
