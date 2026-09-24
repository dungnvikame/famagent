"use client";

import { useState } from "react";
import type { FamilyProfile } from "@/lib/experience/types";
import { careMethodById, type CareMethodId } from "@/lib/care/methods";
import { CareMethodChooser } from "./care-method-chooser";

/** Family page: the chosen parenting approach and its daily practices; without a choice, the chooser. */
export function CareMethodPanel({ profile, onChoose }: { profile: FamilyProfile; onChoose: (id: CareMethodId) => void }) {
  const [choosing, setChoosing] = useState(false);
  const method = careMethodById(profile.household?.careMethod);
  return <section className="form-card" id="care-method"><div><span className="section-number">★</span><h2>Phương pháp nuôi dạy</h2><p>Chọn một phương pháp được nhiều gia đình trên thế giới dùng — FamAgent nhắc các việc hằng ngày của phương pháp đó.</p></div>
    {method && !choosing
      ? <div className="fw-panel"><div className="fw-panel-head"><div><b>{method.name} · {method.ages.label}</b><small>{method.origin}</small></div><button type="button" className="ledger-link" onClick={() => setChoosing(true)}>Đổi phương pháp</button></div>
          <p className="fw-idea" style={{ margin: 0 }}>{method.idea}</p>
          <ol className="care-practices">{method.practices.map((line) => <li key={line}>{line}</li>)}</ol></div>
      : <div className="fw-panel">{method && <div className="fw-panel-head"><span /><button type="button" className="ledger-link" onClick={() => setChoosing(false)}>Đóng</button></div>}
          <CareMethodChooser profile={profile} value={method?.id} onChange={(id) => { onChoose(id); setChoosing(false); }} /></div>}
  </section>;
}
