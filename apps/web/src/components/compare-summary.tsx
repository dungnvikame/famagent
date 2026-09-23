"use client";

import { useEffect, useState } from "react";
import { getProfile, trackEvent } from "@/lib/experience/storage";

/** Shows the fact-based template at once; swaps in AI wording only if the server's fact-guard accepted it. */
export function CompareSummary({ template, items, count }: { template: string; items: string; count: number }) {
  const [text, setText] = useState(template);
  useEffect(() => {
    trackEvent("product_compared", { count });
    if (!items) return;
    const controller = new AbortController();
    void fetch("/api/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, aiConsent: getProfile()?.aiConsent === true }), signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ text: string; source: "ai" | "template" }> : null)
      .then((result) => { if (result?.source === "ai" && result.text) setText(result.text); })
      .catch(() => { /* template stays */ });
    return () => controller.abort();
  }, [items, count]);
  return <div className="compare-summary"><span className="agent-avatar">✳</span><p>{text}</p></div>;
}
