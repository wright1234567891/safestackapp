// src/components/WasteLogSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { FaChevronLeft, FaPlus, FaTrashAlt } from "react-icons/fa";

const chip = (bg, fg) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: bg,
  color: fg,
});

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function WasteLogSection({ site, user, goBack }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  // form
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("portion");
  const [reason, setReason] = useState("Expired");
  const [notes, setNotes] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");

  useEffect(() => {
    if (!site) return;

    // ✅ this query WILL likely require a composite index (site + createdAt)
    const q = query(
      collection(db, "wasteLogs"),
      where("site", "==", site),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Waste logs subscribe error:", err);
        setRows([]);
      }
    );
  }, [site]);

  const canAdd = item.trim().length > 0 && !busy;

  const addWaste = async () => {
    if (!item.trim()) return;
    setBusy(true);

    const qNum = Number(qty);
    const costNum = Number(estimatedCost);

    const payload = {
      site,
      item: item.trim(),
      qty: Number.isFinite(qNum) ? qNum : null,
      unit: (unit || "").trim(),
      reason: (reason || "").trim(),
      notes: notes.trim() || "",
      estimatedCost: Number.isFinite(costNum) ? costNum : null,
      createdAt: serverTimestamp(),
      createdBy: user?.name || user?.uid || "Unknown",
      createdByUid: user?.uid || null,
    };

    try {
      await addDoc(collection(db, "wasteLogs"), payload);
      setItem("");
      setQty("");
      setNotes("");
      setEstimatedCost("");
    } catch (e) {
      console.error("Add waste error:", e);
      alert("Couldn’t add waste entry. Check connection / permissions.");
    } finally {
      setBusy(false);
    }
  };

  const todayTotals = useMemo(() => {
    const today = startOfToday().getTime();
    let count = 0;
    let cost = 0;

    rows.forEach((r) => {
      const dt = r.createdAt?.toDate?.() || null;
      if (!dt) return;
      if (dt.getTime() < today) return;

      count += 1;
      if (typeof r.estimatedCost === "number") cost += r.estimatedCost;
    });

    return { count, cost };
  }, [rows]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={goBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
        >
          <FaChevronLeft /> Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: "#f3f4f6", display: "grid", placeItems: "center" }}>
            <FaTrashAlt color="#111" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>Waste Log</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{site}</div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <span style={chip("#f3f4f6", "#111827")}>Today: <strong>{todayTotals.count}</strong> entries</span>
        <span style={chip("#ecfeff", "#075985")}>Est. cost today: <strong>£{todayTotals.cost.toFixed(2)}</strong></span>
      </div>

      {/* Add card */}
      <div
        style={{
          marginTop: 18,
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontWeight: 900, color: "#111" }}>Add waste entry</div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 110px 140px", gap: 12, marginTop: 14 }}>
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Item e.g. pulled pork (pan), croissants, milk"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
          />
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty"
            inputMode="decimal"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, background: "#fff" }}
          >
            <option value="portion">portion</option>
            <option value="pack">pack</option>
            <option value="kg">kg</option>
            <option value="litre">litre</option>
            <option value="unit">unit</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, marginTop: 12 }}>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, background: "#fff" }}
          >
            <option value="Expired">Expired</option>
            <option value="Spoiled">Spoiled</option>
            <option value="Over-produced">Over-produced</option>
            <option value="Customer return">Customer return</option>
            <option value="Prep waste">Prep waste</option>
            <option value="Dropped/contaminated">Dropped/contaminated</option>
            <option value="Other">Other</option>
          </select>

          <input
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            placeholder="Est. cost (£)"
            inputMode="decimal"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
          />
        </div>

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional) e.g. batch, reason details"
          style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
        />

        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <button
            onClick={addWaste}
            disabled={!canAdd}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              background: canAdd ? "#111827" : "#9ca3af",
              color: "#fff",
              cursor: canAdd ? "pointer" : "not-allowed",
              fontWeight: 900,
            }}
          >
            <FaPlus /> {busy ? "Adding..." : "Add"}
          </button>

          <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>
            Tip: staff can log in under 10 seconds. That’s the goal.
          </div>
        </div>
      </div>

      {/* List */}
      <div
        style={{
          marginTop: 18,
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, color: "#111" }}>Recent entries</div>
          <span style={chip("#f3f4f6", "#111827")}>{rows.length} total</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ marginTop: 12, color: "#6b7280", fontSize: 13 }}>No waste entries yet.</div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {rows.slice(0, 50).map((r) => {
              const dt = r.createdAt?.toDate?.() || null;
              return (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 14,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, color: "#111" }}>{r.item || "Untitled"}</div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      {dt ? dt.toLocaleString() : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                    <span style={chip("#f3f4f6", "#111827")}>
                      {r.qty ?? "—"} {r.unit || ""}
                    </span>
                    <span style={chip("#ecfeff", "#075985")}>{r.reason || "—"}</span>
                    {typeof r.estimatedCost === "number" && (
                      <span style={chip("#fef3c7", "#92400e")}>£{r.estimatedCost.toFixed(2)}</span>
                    )}
                    {r.createdBy && <span style={chip("#f3f4f6", "#374151")}>By: {r.createdBy}</span>}
                  </div>

                  {r.notes ? <div style={{ fontSize: 12, color: "#374151" }}>{r.notes}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}