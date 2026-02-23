// src/components/StaffManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { FaChevronLeft, FaUserPlus, FaUserSlash, FaUserCheck, FaPlus, FaTrashAlt } from "react-icons/fa";

const STAFF_COLLECTION = "StaffLogin";
const SHIFTS_COLLECTION = "Shifts";

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

const roleChip = (role) => {
  const r = (role || "Staff").toLowerCase();
  if (r === "manager") return chip("#eef2ff", "#3730a3");
  return chip("#f3f4f6", "#374151");
};

const statusChip = (active) => (active ? chip("#dcfce7", "#166534") : chip("#fee2e2", "#991b1b"));

const pad2 = (n) => String(n).padStart(2, "0");

const startOfWeekMonday = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun ... 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // back to Monday
  x.setDate(x.getDate() + diff);
  return x;
};

const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const isoDate = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
};

const fmtDay = (d) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

const fmtTime = (ts) => {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const combineDateTimeToTimestamp = (dateStr, timeStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Timestamp.fromDate(dt);
};

const inputStyle = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  fontSize: 14,
  outline: "none",
  width: "100%",
};

const StaffManager = ({ goBack }) => {
  // staff
  const [name, setName] = useState("");
  const [role, setRole] = useState("Staff");
  const [staff, setStaff] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // tabs
  const [tab, setTab] = useState("staff"); // "staff" | "rota"

  // rota
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [shifts, setShifts] = useState([]);

  // add shift modal
  const [showAddShift, setShowAddShift] = useState(false);
  const [shiftStaffId, setShiftStaffId] = useState("");
  const [shiftRole, setShiftRole] = useState("Staff");
  const [shiftDate, setShiftDate] = useState(() => isoDate(new Date()));
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("15:00");
  const [shiftNotes, setShiftNotes] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, STAFF_COLLECTION), orderBy("name")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setStaff(rows);

        // prime default staff selection for shift modal
        if (!shiftStaffId) {
          const firstActive = rows.find((s) => s.active !== false);
          if (firstActive) {
            setShiftStaffId(firstActive.id);
            setShiftRole(firstActive.role || "Staff");
          }
        }
      },
      (err) => {
        console.error("Staff subscribe error:", err);
        setStaff([]);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (showInactive) return staff;
    return staff.filter((s) => s.active !== false);
  }, [staff, showInactive]);

  const canAdd = useMemo(() => name.trim().length > 0 && !busy, [name, busy]);

  const addStaff = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, STAFF_COLLECTION), {
        name: name.trim(),
        role,
        active: true,
        createdAt: new Date(),
      });
      setName("");
      setRole("Staff");
    } catch (e) {
      console.error("Add staff failed:", e);
      alert("Couldn’t add staff. Check Firestore permissions / connection.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (s) => {
    if (!s?.id) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, STAFF_COLLECTION, s.id), { active: !(s.active !== false) });
    } catch (e) {
      console.error("Toggle active failed:", e);
      alert("Couldn’t update staff. Check Firestore permissions / connection.");
    } finally {
      setBusy(false);
    }
  };

  // ---------- ROTA ----------
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => {
    // live shifts for the visible week
    const q = query(
      collection(db, SHIFTS_COLLECTION),
      where("startAt", ">=", Timestamp.fromDate(weekStart)),
      where("startAt", "<", Timestamp.fromDate(weekEnd)),
      orderBy("startAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Shifts subscribe error:", err);
        setShifts([]);
      }
    );
    return () => unsub();
  }, [weekStart, weekEnd]);

  const staffById = useMemo(() => {
    const m = new Map();
    staff.forEach((s) => m.set(s.id, s));
    return m;
  }, [staff]);

  const shiftsByDay = useMemo(() => {
    const map = new Map();
    for (const d of days) map.set(isoDate(d), []);
    for (const s of shifts) {
      const d = s.startAt?.toDate?.() ? s.startAt.toDate() : null;
      if (!d) continue;
      const key = isoDate(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return map;
  }, [days, shifts]);

  const openAddShift = (d) => {
    setShiftDate(isoDate(d));
    const firstActive = staff.find((s) => s.active !== false);
    if (firstActive) {
      setShiftStaffId(firstActive.id);
      setShiftRole(firstActive.role || "Staff");
    }
    setShiftStart("09:00");
    setShiftEnd("15:00");
    setShiftNotes("");
    setShowAddShift(true);
  };

  const canSaveShift = useMemo(() => {
    if (busy) return false;
    if (!shiftStaffId) return false;
    if (!shiftDate) return false;
    if (!shiftStart || !shiftEnd) return false;
    const st = combineDateTimeToTimestamp(shiftDate, shiftStart).toDate();
    const et = combineDateTimeToTimestamp(shiftDate, shiftEnd).toDate();
    return et > st;
  }, [busy, shiftStaffId, shiftDate, shiftStart, shiftEnd]);

  const addShift = async () => {
    if (!canSaveShift) return;
    setBusy(true);
    try {
      const s = staffById.get(shiftStaffId);
      const startAt = combineDateTimeToTimestamp(shiftDate, shiftStart);
      const endAt = combineDateTimeToTimestamp(shiftDate, shiftEnd);

      await addDoc(collection(db, SHIFTS_COLLECTION), {
        staffId: shiftStaffId,
        staffName: s?.name || "",
        role: shiftRole || s?.role || "Staff",
        startAt,
        endAt,
        notes: shiftNotes?.trim() || "",
        status: "draft",
        createdAt: Timestamp.now(),
      });

      setShowAddShift(false);
    } catch (e) {
      console.error("Add shift failed:", e);
      alert("Couldn’t add shift. Check Firestore permissions / connection.");
    } finally {
      setBusy(false);
    }
  };

  const removeShift = async (shiftId) => {
    if (!shiftId) return;
    if (!confirm("Delete this shift?")) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, SHIFTS_COLLECTION, shiftId));
    } catch (e) {
      console.error("Delete shift failed:", e);
      alert("Couldn’t delete shift. Check Firestore permissions / connection.");
    } finally {
      setBusy(false);
    }
  };

  const toggleBtn = (active) => ({
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: active ? "#2563eb" : "#fff",
    color: active ? "#fff" : "#111",
    fontWeight: 800,
    cursor: "pointer",
  });

  const tabBtn = (active) => ({
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    fontWeight: 900,
    cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
      {/* Header row */}
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
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "#f3f4f6",
              display: "grid",
              placeItems: "center",
            }}
          >
            <FaUserCheck color="#374151" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>Staff</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Manage staff + weekly rota</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button style={tabBtn(tab === "staff")} onClick={() => setTab("staff")}>
          Staff
        </button>
        <button style={tabBtn(tab === "rota")} onClick={() => setTab("rota")}>
          Rota
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {tab === "staff" ? (
            <>
              <button onClick={() => setShowInactive(false)} style={toggleBtn(!showInactive)}>
                Active
              </button>
              <button onClick={() => setShowInactive(true)} style={toggleBtn(showInactive)}>
                All
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* STAFF TAB */}
      {tab === "staff" ? (
        <>
          {/* Add staff card */}
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
              <div style={{ fontWeight: 900, color: "#111" }}>Add staff member</div>
              <span style={chip("#eef2ff", "#3730a3")}>Shows on login</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 12, marginTop: 14 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name e.g. Sam"
                style={inputStyle}
              />
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="Manager">Manager</option>
                <option value="Staff">Staff</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={addStaff}
                disabled={!canAdd}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: canAdd ? "#2563eb" : "#93c5fd",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: canAdd ? "pointer" : "not-allowed",
                }}
                onMouseEnter={(e) => {
                  if (canAdd) e.currentTarget.style.backgroundColor = "#1d4ed8";
                }}
                onMouseLeave={(e) => {
                  if (canAdd) e.currentTarget.style.backgroundColor = "#2563eb";
                }}
              >
                <FaUserPlus /> {busy ? "Saving..." : "Add staff"}
              </button>
            </div>
          </div>

          {/* List card */}
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
              <div style={{ fontWeight: 900, color: "#111" }}>Existing staff</div>
              <span style={chip("#f3f4f6", "#111827")}>{filtered.length} shown</span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ marginTop: 14, color: "#6b7280", fontSize: 13 }}>No staff to show.</div>
            ) : (
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {filtered.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "center",
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 14,
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.08)";
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.backgroundColor = "#fff";
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: "#111", fontSize: 15 }}>
                        {s.name}{" "}
                        <span style={{ ...roleChip(s.role), marginLeft: 8 }}>{s.role || "Staff"}</span>{" "}
                        <span style={{ ...statusChip(s.active !== false), marginLeft: 8 }}>
                          {s.active !== false ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        {s.active !== false ? "Can be selected at login" : "Hidden from login"}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleActive(s)}
                      disabled={busy}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        cursor: busy ? "not-allowed" : "pointer",
                        fontWeight: 900,
                        color: s.active !== false ? "#b91c1c" : "#16a34a",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => {
                        if (!busy) e.currentTarget.style.backgroundColor = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#fff";
                      }}
                    >
                      <FaUserSlash /> {s.active !== false ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* ROTA TAB */}
      {tab === "rota" ? (
        <>
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
              <div>
                <div style={{ fontWeight: 900, color: "#111" }}>Weekly rota</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  Week of {fmtDay(weekStart)} → {fmtDay(addDays(weekStart, 6))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={toggleBtn(false)} onClick={() => setWeekStart((w) => addDays(w, -7))}>
                  ← Prev
                </button>
                <button style={toggleBtn(false)} onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
                  This week
                </button>
                <button style={toggleBtn(false)} onClick={() => setWeekStart((w) => addDays(w, 7))}>
                  Next →
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {days.map((d) => {
                const key = isoDate(d);
                const dayShifts = shiftsByDay.get(key) || [];
                return (
                  <div key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900, color: "#111" }}>{fmtDay(d)}</div>
                      <button
                        style={{ ...toggleBtn(false), display: "inline-flex", alignItems: "center", gap: 8 }}
                        onClick={() => openAddShift(d)}
                      >
                        <FaPlus /> Add shift
                      </button>
                    </div>

                    {dayShifts.length === 0 ? (
                      <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>No shifts.</div>
                    ) : (
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        {dayShifts.map((s) => (
                          <div
                            key={s.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 12,
                              alignItems: "center",
                              border: "1px solid #e5e7eb",
                              borderRadius: 12,
                              padding: 12,
                              background: "#f9fafb",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 900, color: "#111", fontSize: 14 }}>
                                {s.staffName || staffById.get(s.staffId)?.name || "Unknown"}{" "}
                                <span style={{ ...roleChip(s.role), marginLeft: 8 }}>{s.role || "Staff"}</span>
                                {s.status === "published" ? (
                                  <span style={{ ...chip("#dcfce7", "#166534"), marginLeft: 8 }}>Published</span>
                                ) : (
                                  <span style={{ ...chip("#fef9c3", "#854d0e"), marginLeft: 8 }}>Draft</span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: "#374151", marginTop: 4 }}>
                                {fmtTime(s.startAt)} – {fmtTime(s.endAt)}
                                {s.notes ? <span style={{ color: "#6b7280" }}> · {s.notes}</span> : null}
                              </div>
                            </div>

                            <button
                              onClick={() => removeShift(s.id)}
                              disabled={busy}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "10px 12px",
                                borderRadius: 12,
                                border: "1px solid #e5e7eb",
                                background: "#fff",
                                cursor: busy ? "not-allowed" : "pointer",
                                fontWeight: 900,
                                color: "#b91c1c",
                                whiteSpace: "nowrap",
                              }}
                              onMouseEnter={(e) => {
                                if (!busy) e.currentTarget.style.backgroundColor = "#fef2f2";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#fff";
                              }}
                            >
                              <FaTrashAlt /> Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add shift modal */}
          {showAddShift ? (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "grid",
                placeItems: "center",
                padding: 16,
                zIndex: 50,
              }}
              onClick={() => !busy && setShowAddShift(false)}
            >
              <div
                style={{
                  width: "min(720px, 100%)",
                  background: "#fff",
                  borderRadius: 16,
                  boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
                  padding: 16,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#111", fontSize: 16 }}>Add shift</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Quick roster entry (MVP Deputy replacement)</div>
                  </div>
                  <button style={toggleBtn(false)} onClick={() => !busy && setShowAddShift(false)}>
                    Close
                  </button>
                </div>

                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}>
                  <select
                    value={shiftStaffId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setShiftStaffId(id);
                      const s = staffById.get(id);
                      if (s?.role) setShiftRole(s.role);
                    }}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    {staff
                      .filter((s) => s.active !== false)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role || "Staff"})
                        </option>
                      ))}
                  </select>

                  <select value={shiftRole} onChange={(e) => setShiftRole(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="Manager">Manager</option>
                    <option value="Staff">Staff</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Front">Front</option>
                  </select>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "220px 1fr 1fr", gap: 12 }}>
                  <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} style={inputStyle} />
                  <input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} style={inputStyle} />
                  <input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} style={inputStyle} />
                </div>

                <div style={{ marginTop: 12 }}>
                  <input
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    placeholder="Notes (optional) e.g. open/close, break covered"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button style={toggleBtn(false)} onClick={() => !busy && setShowAddShift(false)}>
                    Cancel
                  </button>
                  <button
                    onClick={addShift}
                    disabled={!canSaveShift}
                    style={{
                      ...toggleBtn(false),
                      background: canSaveShift ? "#2563eb" : "#93c5fd",
                      border: "none",
                      color: "#fff",
                      cursor: canSaveShift ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 900,
                    }}
                    onMouseEnter={(e) => {
                      if (canSaveShift) e.currentTarget.style.backgroundColor = "#1d4ed8";
                    }}
                    onMouseLeave={(e) => {
                      if (canSaveShift) e.currentTarget.style.backgroundColor = "#2563eb";
                    }}
                  >
                    <FaPlus /> {busy ? "Saving..." : "Save shift"}
                  </button>
                </div>

                {!canSaveShift ? (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                    End time must be after start time.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default StaffManager;