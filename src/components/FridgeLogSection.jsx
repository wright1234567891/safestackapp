// src/components/FridgeLogSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { FaChevronLeft, FaPlus, FaCircle, FaTrash, FaFireAlt } from "react-icons/fa";

// ---- small helpers ----
const chip = (bg, fg) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  background: bg,
  color: fg,
});

const btn = (bg, fg) => ({
  border: "none",
  borderRadius: 10,
  padding: "10px 12px",
  background: bg,
  color: fg,
  cursor: "pointer",
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
});

const inputStyle = {
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  fontSize: 14,
  outline: "none",
};

function toYmd(d) {
  if (!d) return "";
  const dd = d instanceof Date ? d : new Date(d);
  const yyyy = dd.getFullYear();
  const mm = String(dd.getMonth() + 1).padStart(2, "0");
  const day = String(dd.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${day}`;
}

function parseYmd(ymd) {
  if (!ymd) return null;
  // ymd "YYYY-MM-DD"
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function flagForUseBy(useBy) {
  const now = Date.now();
  const useByMs = useBy?.toDate?.()?.getTime?.() ?? (useBy instanceof Date ? useBy.getTime() : null);
  if (!useByMs) return "green";
  if (useByMs < now) return "red";
  if (useByMs - now < 24 * 60 * 60 * 1000) return "amber";
  return "green";
}

function flagDot(flag) {
  if (flag === "red") return "#dc2626";
  if (flag === "amber") return "#f59e0b";
  return "#16a34a";
}

export default function FridgeLogSection({ site, user, equipment, goBack }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  // Add form
  const [selectedEqId, setSelectedEqId] = useState("");
  const [itemName, setItemName] = useState("");
  const [useByYmd, setUseByYmd] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const coldEquipment = useMemo(() => {
    const list = Array.isArray(equipment) ? equipment : [];
    return list.filter((e) => ["fridge", "freezer"].includes(String(e.type || "").toLowerCase()));
  }, [equipment]);

  // default select first fridge/freezer when available
  useEffect(() => {
    if (selectedEqId) return;
    if (coldEquipment.length > 0) setSelectedEqId(coldEquipment[0].id);
  }, [coldEquipment, selectedEqId]);

  // ---- Firestore subscribe ----
  useEffect(() => {
    if (!site) return;

    setLoading(true);
    setErrMsg("");

    const qRef = query(
      collection(db, "fridgeBatches"),
      where("site", "==", site),
      orderBy("useBy", "asc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("fridgeBatches subscribe error:", err);
        setLoading(false);

        // Helpful message (common cause is composite index requirement)
        const msg = (err?.message || "Could not load fridge log.").toString();
        if (msg.toLowerCase().includes("index")) {
          setErrMsg(
            "Firestore needs an index for this query (site + useBy). Open the browser console and click the Firestore index link, then create the index."
          );
        } else {
          setErrMsg(msg);
        }
      }
    );

    return () => unsub();
  }, [site]);

  const batchesWithFlags = useMemo(() => {
    return batches.map((b) => ({ ...b, _flag: flagForUseBy(b.useBy) }));
  }, [batches]);

  const byEquipment = useMemo(() => {
    const map = new Map();
    for (const eq of coldEquipment) map.set(eq.id, { eq, rows: [] });

    for (const b of batchesWithFlags) {
      const key = b.equipmentId || b.equipment_id || "";
      if (!map.has(key)) {
        // batch points to equipment that no longer exists / not in list
        map.set(key || `unknown-${b.id}`, {
          eq: { id: key, name: b.equipmentName || "Unknown location", type: "Fridge" },
          rows: [],
        });
      }
      map.get(key || `unknown-${b.id}`).rows.push(b);
    }

    // stable list: equipment order first, then unknown groups
    return Array.from(map.values());
  }, [coldEquipment, batchesWithFlags]);

  const canAdd = useMemo(() => {
    return !!site && !!selectedEqId && itemName.trim().length > 0 && !!useByYmd && !busy;
  }, [site, selectedEqId, itemName, useByYmd, busy]);

  const addBatch = async () => {
    if (!canAdd) return;
    setBusy(true);

    const eq = coldEquipment.find((e) => e.id === selectedEqId);
    const useByDate = parseYmd(useByYmd);

    try {
      await addDoc(collection(db, "fridgeBatches"), {
        site,
        equipmentId: selectedEqId,
        equipmentName: eq?.name || "",
        equipmentType: eq?.type || "",
        itemName: itemName.trim(),
        useBy: useByDate, // Firestore will store as Timestamp
        notes: notes.trim(),
        status: "IN_USE",
        reheats: 0,
        maxReheats: 1,
        openedAt: null,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || user?.name || null,
      });

      setItemName("");
      setUseByYmd("");
      setNotes("");
    } catch (e) {
      console.error("addBatch error:", e);
      alert("Couldn’t add batch. Check permissions / connection.");
    } finally {
      setBusy(false);
    }
  };

  const markOpened = async (batchId) => {
    try {
      await updateDoc(doc(db, "fridgeBatches", batchId), { openedAt: serverTimestamp() });
    } catch (e) {
      console.error("markOpened error:", e);
      alert("Couldn’t mark as opened.");
    }
  };

  const reheat = async (batchId, currentReheats = 0, maxReheats = 1) => {
    if (currentReheats >= maxReheats) {
      alert("Already reheated the maximum allowed. Discard after service.");
      return;
    }
    try {
      await updateDoc(doc(db, "fridgeBatches", batchId), { reheats: increment(1) });
    } catch (e) {
      console.error("reheat error:", e);
      alert("Couldn’t log reheat.");
    }
  };

  const discard = async (batchId) => {
    const ok = window.confirm("Discard this batch?");
    if (!ok) return;
    try {
      await updateDoc(doc(db, "fridgeBatches", batchId), {
        status: "DISCARDED",
        discardedAt: serverTimestamp(),
        discardedBy: user?.uid || user?.name || null,
      });
    } catch (e) {
      console.error("discard error:", e);
      alert("Couldn’t discard batch.");
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
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
        >
          <FaChevronLeft /> Back
        </button>

        <div style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>Fridge Log</div>
        <span style={chip("#eef2ff", "#3730a3")}>{site}</span>
      </div>

      {/* Error / loading */}
      {errMsg && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 14,
            border: "1px solid #fee2e2",
            background: "#fef2f2",
            color: "#991b1b",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {errMsg}
        </div>
      )}

      {/* Add batch */}
      <div
        style={{
          marginTop: 18,
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, color: "#111" }}>Add batch to fridge/freezer</div>
          <span style={chip("#f3f4f6", "#111827")}>Tracks use-by + reheats</span>
        </div>

        {coldEquipment.length === 0 ? (
          <div style={{ marginTop: 12, color: "#6b7280", fontSize: 13 }}>
            No fridges/freezers found for this venue. Add them in <strong>Add Equipment</strong>.
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "220px 1fr 170px", gap: 12 }}>
            <select value={selectedEqId} onChange={(e) => setSelectedEqId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {coldEquipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.type})
                </option>
              ))}
            </select>

            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Item e.g. Sliced brisket (vac pack), pulled pork, chicken"
              style={inputStyle}
            />

            <input
              type="date"
              value={useByYmd}
              onChange={(e) => setUseByYmd(e.target.value)}
              style={inputStyle}
              title="Use-by date"
            />
          </div>
        )}

        {coldEquipment.length > 0 && (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional) e.g. opened for service / allergen / batch info"
              style={inputStyle}
            />

            <button
              onClick={addBatch}
              disabled={!canAdd}
              style={btn(canAdd ? "#2563eb" : "#93c5fd", "#fff")}
              title={!canAdd ? "Select equipment, enter item name, choose use-by" : "Add batch"}
            >
              <FaPlus /> {busy ? "Adding..." : "Add"}
            </button>
          </div>
        )}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, color: "#111" }}>Batches</div>
          {loading ? <span style={chip("#fef3c7", "#92400e")}>Loading…</span> : <span style={chip("#f3f4f6", "#111827")}>{batches.length} total</span>}
        </div>

        {!loading && batches.length === 0 ? (
          <div style={{ marginTop: 12, color: "#6b7280", fontSize: 13 }}>
            No batches logged yet.
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
            {byEquipment.map(({ eq, rows }) => {
              const eqName = eq?.name || "Unknown location";
              const eqType = String(eq?.type || "").toLowerCase();
              const badge = eqType === "freezer" ? chip("#e0f2fe", "#075985") : chip("#fee2e2", "#991b1b");

              return (
                <div key={eq?.id || eqName} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, color: "#111" }}>{eqName}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={badge}>{eqType ? eqType[0].toUpperCase() + eqType.slice(1) : "Fridge"}</span>
                      <span style={chip("#f3f4f6", "#111827")}>{rows.length} item(s)</span>
                    </div>
                  </div>

                  {rows.length === 0 ? (
                    <div style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>No batches in this location.</div>
                  ) : (
                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      {rows.map((b) => {
                        const flag = b._flag;
                        const dot = flagDot(flag);
                        const status = String(b.status || "IN_USE").toUpperCase();

                        const useByDate = b.useBy?.toDate?.() || null;
                        const useByStr = useByDate ? toYmd(useByDate) : "—";

                        const opened = !!b.openedAt;
                        const reheats = Number(b.reheats || 0);
                        const maxReheats = Number(b.maxReheats || 1);

                        return (
                          <div
                            key={b.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 12,
                              alignItems: "center",
                              padding: 12,
                              borderRadius: 14,
                              border: "1px solid #e5e7eb",
                              background: status === "DISCARDED" ? "#f9fafb" : "#fff",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <FaCircle size={10} color={dot} title={flag} />
                                <div style={{ fontWeight: 900, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {b.itemName || "Untitled"}
                                </div>
                                {status === "DISCARDED" ? (
                                  <span style={chip("#e5e7eb", "#111827")}>DISCARDED</span>
                                ) : (
                                  <span style={chip("#ecfeff", "#075985")}>Use-by: {useByStr}</span>
                                )}
                                {opened && <span style={chip("#dcfce7", "#166534")}>Opened</span>}
                                <span style={chip("#f3f4f6", "#111827")}>
                                  Reheats: {reheats}/{maxReheats}
                                </span>
                              </div>

                              {b.notes ? (
                                <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>{b.notes}</div>
                              ) : null}
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {status !== "DISCARDED" && (
                                <>
                                  <button
                                    onClick={() => markOpened(b.id)}
                                    style={btn("#111827", "#fff")}
                                    title="Mark pack as opened"
                                  >
                                    Opened
                                  </button>

                                  <button
                                    onClick={() => reheat(b.id, reheats, maxReheats)}
                                    style={btn("#f59e0b", "#111")}
                                    title="Log one reheat"
                                  >
                                    <FaFireAlt /> Reheat
                                  </button>

                                  <button
                                    onClick={() => discard(b.id)}
                                    style={btn("#dc2626", "#fff")}
                                    title="Discard this batch"
                                  >
                                    <FaTrash /> Discard
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}