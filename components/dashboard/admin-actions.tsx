"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Actie mislukt");
}

export function AdminPublishInvoice({ invoiceId }: { invoiceId: string }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  return <div><button className="button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await postJson(`/api/admin/invoices/${invoiceId}/publish`); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Actie mislukt"); } finally { setBusy(false); } }}>{busy ? "Bezig..." : "Publiceren"}</button>{error && <small className="action-error">{error}</small>}</div>;
}

export function AdminDisputeActions({ disputeId }: { disputeId: string }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  const decide = async (decision: "APPROVE_CREDIT" | "REJECT") => { setBusy(true); setError(""); try { await postJson(`/api/admin/disputes/${disputeId}/resolve`, { decision, resolution: decision === "APPROVE_CREDIT" ? "Geschil goedgekeurd en lead gecrediteerd." : "Geschil beoordeeld en afgewezen." }); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Actie mislukt"); } finally { setBusy(false); } };
  return <div className="admin-action-group"><button className="button" disabled={busy} onClick={() => decide("APPROVE_CREDIT")}>Crediteren</button><button className="button danger" disabled={busy} onClick={() => decide("REJECT")}>Afwijzen</button>{error && <small className="action-error">{error}</small>}</div>;
}
