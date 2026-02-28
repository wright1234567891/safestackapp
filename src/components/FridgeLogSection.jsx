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
  deleteDoc,
  doc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { FaChevronLeft, FaPlus, FaCircle, FaTrash, FaFireAlt, FaEdit, FaSave, FaTimes } from "react-icons/fa";

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
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  // midday avoids timezone “previous day” issues in some browsers
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function getUseByMs(useBy) {
  const ms =
    useBy?.toDate?.()?.getTime?.() ??
    (useBy instanceof Date ? useBy.getTime() : null);
  return ms || null;
}

function flagForUseBy(useBy) {
  const now = Date.now();
  const useByMs = getUseByMs(useBy);
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

  // UI options
  const [showDiscarded, setShowDiscarded] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState("");

  const [editEqId, setEditEqId] = useState("");
  const [editItemName, setEditItemName] = useState("");
  const [editUseByYmd, setEditUseByYmd] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editMaxReheats, setEditMaxReheats] = useState("1");
  const [editStatus, setEditStatus] = useState("IN_USE");

  const coldEquipment = useMemo(() => {
    const list = Array.isArray(equipment) ? equipment : [];
    return list.filter((e) =>
      ["fridge", "freezer"].includes(String(e.type || "").toLowerCase())
    );
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

  const filteredBatches = useMemo(() => {
    if (showDiscarded) return batchesWithFlags;
    return batchesWithFlags.filter(
      (b) => String(b.status || "IN_USE").toUpperCase() !== "DISCARDED"
    );
  }, [batchesWithFlags, showDiscarded]);

  const byEquipment = useMemo(() => {
    const map = new Map();
    for (const eq of coldEquipment) map.set(eq.id, { eq, rows: [] });

    for (const b of filteredBatches) {
      const key = b.equipmentId || b.equipment_id || "";
      if (!map.has(key)) {
        map.set(key || `unknown-${b.id}`, {
          eq: { id: key, name: b.equipmentName || "Unknown location", type: "Fridge" },
          rows: [],
        });
      }
      map.get(key || `unknown-${b.id}`).rows.push(b);
    }

    return Array.from(map.values());
  }, [coldEquipment, filteredBatches]);

  const canAdd = useMemo(() => {
    return (
      !!site &&
      !!selectedEqId &&
      itemName.trim().length > 0 &&
      !!useByYmd &&
      !busy
    );
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
        useBy: useByDate, // stored as Timestamp
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
    const ok = window.confirm("Discard this batch? (It will stay in the log as DISCARDED)");
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

  const hardDelete = async (batchId) => {
    const ok = window.confirm(
      "Permanently delete this batch? This cannot be undone."
    );
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "fridgeBatches", batchId));
    } catch (e) {
      console.error("hardDelete error:", e);
      alert("Couldn’t delete batch.");
    }
  };

  const startEdit = (b) => {
    setEditErr("");
    setEditingId(b.id);

    const currentEqId = b.equipmentId || b.equipment_id || "";
    const useByDate = b.useBy?.toDate?.() || (b.useBy instanceof Date ? b.useBy : null);

    setEditEqId(currentEqId || selectedEqId || (coldEquipment[0]?.id ?? ""));
    setEditItemName(String(b.itemName || ""));
    setEditUseByYmd(useByDate ? toYmd(useByDate) : "");
    setEditNotes(String(b.notes || ""));
    setEditMaxReheats(String(Number(b.maxReheats || 1)));
    setEditStatus(String(b.status || "IN_USE").toUpperCase());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditErr("");
    setEditBusy(false);
  };

  const saveEdit = async (batchId) => {
    if (!site) return;
    if (!editEqId) {
      setEditErr("Select a fridge/freezer location.");
      return;
    }
    if (!editItemName.trim()) {
      setEditErr("Item name can’t be empty.");
      return;
    }
    if (!editUseByYmd) {
      setEditErr("Use-by date is required.");
      return;
    }

    const eq = coldEquipment.find((e) => e.id === editEqId);
    const useByDate = parseYmd(editUseByYmd);
    const maxRh = Number(editMaxReheats || 1);

    if (!Number.isFinite(maxRh) || maxRh < 0 || maxRh > 50) {
      setEditErr("Max reheats must be a sensible number (0–50).");
      return;
    }

    setEditBusy(true);
    setEditErr("");

    try {
      await updateDoc(doc(db, "fridgeBatches", batchId), {
        equipmentId: editEqId,
        equipmentName: eq?.name || "",
        equipmentType: eq?.type || "",
        itemName: editItemName.trim(),
        useBy: useByDate,
        notes: editNotes.trim(),
        maxReheats: maxRh,
        status: editStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || user?.name || null,
      });

      setEditingId(null);
    } catch (e) {
      console.error("saveEdit error:", e);
      setEditErr("Couldn’t save changes. Check permissions / connection.");
    } finally {
      setEditBusy(false);
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

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setShowDiscarded((v) => !v)}
              style={btn("#f3f4f6", "#111827")}
              title="Toggle discarded items"
            >
              {showDiscarded ? "Hide discarded" : "Show discarded"}
            </button>

            {loading ? (
              <span style={chip("#fef3c7", "#92400e")}>Loading…</span>
            ) : (
              <span style={chip("#f3f4f6", "#111827")}>{filteredBatches.length} shown</span>
            )}
          </div>
        </div>

        {!loading && filteredBatches.length === 0 ? (
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

                        const isEditing = editingId === b.id;

                        return (
                          <div
                            key={b.id}
                            style={{
                              padding: 12,
                              borderRadius: 14,
                              border: "1px solid #e5e7eb",
                              background: status === "DISCARDED" ? "#f9fafb" : "#fff",
                            }}
                          >
                            {/* Row top */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
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

                              {/* Actions */}
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {!isEditing && (
                                  <button onClick={() => startEdit(b)} style={btn("#2563eb", "#fff")} title="Edit batch">
                                    <FaEdit /> Edit
                                  </button>
                                )}

                                {status !== "DISCARDED" && !isEditing && (
                                  <>
                                    <button onClick={() => markOpened(b.id)} style={btn("#111827", "#fff")} title="Mark pack as opened">
                                      Opened
                                    </button>

                                    <button onClick={() => reheat(b.id, reheats, maxReheats)} style={btn("#f59e0b", "#111")} title="Log one reheat">
                                      <FaFireAlt /> Reheat
                                    </button>

                                    <button onClick={() => discard(b.id)} style={btn("#dc2626", "#fff")} title="Discard this batch (soft delete)">
                                      <FaTrash /> Discard
                                    </button>
                                  </>
                                )}

                                {!isEditing && (
                                  <button
                                    onClick={() => hardDelete(b.id)}
                                    style={btn("#6b7280", "#fff")}
                                    title="Delete permanently"
                                  >
                                    <FaTrash /> Delete
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Edit panel */}
                            {isEditing && (
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                                {editErr && (
                                  <div
                                    style={{
                                      marginBottom: 10,
                                      padding: 12,
                                      borderRadius: 12,
                                      border: "1px solid #fee2e2",
                                      background: "#fef2f2",
                                      color: "#991b1b",
                                      fontWeight: 800,
                                      fontSize: 13,
                                    }}
                                  >
                                    {editErr}
                                  </div>
                                )}

                                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 170px", gap: 12 }}>
                                  <select
                                    value={editEqId}
                                    onChange={(e) => setEditEqId(e.target.value)}
                                    style={{ ...inputStyle, cursor: "pointer" }}
                                  >
                                    {coldEquipment.map((eq2) => (
                                      <option key={eq2.id} value={eq2.id}>
                                        {eq2.name} ({eq2.type})
                                      </option>
                                    ))}
                                  </select>

                                  <input
                                    value={editItemName}
                                    onChange={(e) => setEditItemName(e.target.value)}
                                    placeholder="Item name"
                                    style={inputStyle}
                                  />

                                  <input
                                    type="date"
                                    value={editUseByYmd}
                                    onChange={(e) => setEditUseByYmd(e.target.value)}
                                    style={inputStyle}
                                    title="Use-by date"
                                  />
                                </div>

                                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 170px 170px", gap: 12 }}>
                                  <input
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Notes"
                                    style={inputStyle}
                                  />

                                  <input
                                    value={editMaxReheats}
                                    onChange={(e) => setEditMaxReheats(e.target.value)}
                                    style={inputStyle}
                                    inputMode="numeric"
                                    placeholder="Max reheats"
                                    title="Max reheats"
                                  />

                                  <select
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value)}
                                    style={{ ...inputStyle, cursor: "pointer" }}
                                    title="Status"
                                  >
                                    <option value="IN_USE">IN_USE</option>
                                    <option value="DISCARDED">DISCARDED</option>
                                  </select>
                                </div>

                                <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                  <button
                                    onClick={cancelEdit}
                                    disabled={editBusy}
                                    style={btn("#e5e7eb", "#111827")}
                                    title="Cancel"
                                  >
                                    <FaTimes /> Cancel
                                  </button>

                                  <button
                                    onClick={() => saveEdit(b.id)}
                                    disabled={editBusy}
                                    style={btn(editBusy ? "#93c5fd" : "#16a34a", "#fff")}
                                    title="Save changes"
                                  >
                                    <FaSave /> {editBusy ? "Saving..." : "Save"}
                                  </button>
                                </div>
                              </div>
                            )}
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