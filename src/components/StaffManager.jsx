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
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  FaChevronLeft,
  FaUserPlus,
  FaUserSlash,
  FaUserCheck,
  FaPlus,
  FaTrashAlt,
  FaPen,
  FaEnvelope,
  FaRegCalendarCheck,
} from "react-icons/fa";

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

const fmtDay = (d) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

const fmtDateLong = (d) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

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

const toDateInput = (ts) => {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return isoDate(d);
};

const toTimeInput = (ts) => {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const inputStyle = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  fontSize: 14,
  outline: "none",
  width: "100%",
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 50,
};

const modalStyle = {
  width: "min(760px, 100%)",
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
  padding: 16,
};

export default function StaffManager({ goBack }) {
  // staff
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Staff");
  const [staff, setStaff] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // tabs
  const [tab, setTab] = useState("staff"); // "staff" | "rota"

  // rota
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [shifts, setShifts] = useState([]);

  // view
  const [rotaView, setRotaView] = useState("list"); // "list" | "grid"

  // add shift modal fields
  const [showAddShift, setShowAddShift] = useState(false);
  const [shiftStaffId, setShiftStaffId] = useState("");
  const [shiftRole, setShiftRole] = useState("Staff");
  const [shiftDate, setShiftDate] = useState(() => isoDate(new Date()));
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("15:00");
  const [shiftNotes, setShiftNotes] = useState("");

  // edit shift
  const [editShift, setEditShift] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, STAFF_COLLECTION), orderBy("name")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setStaff(rows);

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

  const activeStaff = useMemo(() => staff.filter((s) => s.active !== false), [staff]);

  const staffById = useMemo(() => {
    const m = new Map();
    staff.forEach((s) => m.set(s.id, s));
    return m;
  }, [staff]);

  const canAdd = useMemo(() => name.trim().length > 0 && !busy, [name, busy]);

  const addStaff = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, STAFF_COLLECTION), {
        name: name.trim(),
        email: email.trim() || "",
        role,
        active: true,
        createdAt: new Date(),
      });
      setName("");
      setEmail("");
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

  const shiftsByStaffByDay = useMemo(() => {
    const map = new Map();
    for (const st of activeStaff) {
      const inner = new Map();
      for (const d of days) inner.set(isoDate(d), []);
      map.set(st.id, inner);
    }
    for (const s of shifts) {
      const d = s.startAt?.toDate?.() ? s.startAt.toDate() : null;
      if (!d) continue;
      const dayKey = isoDate(d);
      const staffId = s.staffId;
      if (!map.has(staffId)) {
        const inner = new Map();
        for (const dd of days) inner.set(isoDate(dd), []);
        map.set(staffId, inner);
      }
      const inner = map.get(staffId);
      if (!inner.has(dayKey)) inner.set(dayKey, []);
      inner.get(dayKey).push(s);
    }
    return map;
  }, [activeStaff, days, shifts]);

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

  const openAddShiftForStaffDay = (staffId, d) => {
    setShiftDate(isoDate(d));
    setShiftStaffId(staffId);
    const st = staffById.get(staffId);
    setShiftRole(st?.role || "Staff");
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

  const setShiftStatus = async (shiftId, status) => {
    if (!shiftId) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, SHIFTS_COLLECTION, shiftId), { status });
    } catch (e) {
      console.error("Set shift status failed:", e);
      alert("Couldn’t update shift status.");
    } finally {
      setBusy(false);
    }
  };

  const publishWeek = async () => {
    setBusy(true);
    try {
      const q = query(
        collection(db, SHIFTS_COLLECTION),
        where("startAt", ">=", Timestamp.fromDate(weekStart)),
        where("startAt", "<", Timestamp.fromDate(weekEnd)),
        orderBy("startAt", "asc")
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { status: "published" }));
      await batch.commit();
    } catch (e) {
      console.error("Publish week failed:", e);
      alert("Couldn’t publish week. Check Firestore index / permissions.");
    } finally {
      setBusy(false);
    }
  };

  const emailShiftLink = (s) => {
    const st = staffById.get(s.staffId);
    const staffEmail = st?.email || "";
    if (!staffEmail) return null;

    const date = s.startAt?.toDate?.() ? fmtDateLong(s.startAt.toDate()) : "";
    const subject = encodeURIComponent(`Your shift: ${date} ${fmtTime(s.startAt)}–${fmtTime(s.endAt)} (Oak & Smoke)`);
    const body = encodeURIComponent(
      `Hi ${s.staffName || st?.name || ""},\n\nYou’re scheduled for:\n${date}\n${fmtTime(s.startAt)} – ${fmtTime(
        s.endAt
      )}\nRole: ${s.role || ""}\n${s.notes ? `Notes: ${s.notes}\n` : ""}\n\nThanks,\nChris`
    );
    return `mailto:${staffEmail}?subject=${subject}&body=${body}`;
  };

  const openEditShift = (s) => {
    if (!s?.id) return;
    const st = staffById.get(s.staffId);
    setEditShift(s);
    setShiftStaffId(s.staffId || "");
    setShiftRole(s.role || st?.role || "Staff");
    setShiftDate(toDateInput(s.startAt));
    setShiftStart(toTimeInput(s.startAt));
    setShiftEnd(toTimeInput(s.endAt));
    setShiftNotes(s.notes || "");
  };

  const canSaveEdit = useMemo(() => {
    if (!editShift?.id) return false;
    if (busy) return false;
    if (!shiftStaffId) return false;
    if (!shiftDate || !shiftStart || !shiftEnd) return false;
    const st = combineDateTimeToTimestamp(shiftDate, shiftStart).toDate();
    const et = combineDateTimeToTimestamp(shiftDate, shiftEnd).toDate();
    return et > st;
  }, [editShift, busy, shiftStaffId, shiftDate, shiftStart, shiftEnd]);

  const saveEditShift = async () => {
    if (!canSaveEdit) return;
    setBusy(true);
    try {
      const startAt = combineDateTimeToTimestamp(shiftDate, shiftStart);
      const endAt = combineDateTimeToTimestamp(shiftDate, shiftEnd);
      const st = staffById.get(shiftStaffId);

      await updateDoc(doc(db, SHIFTS_COLLECTION, editShift.id), {
        staffId: shiftStaffId,
        staffName: st?.name || "",
        role: shiftRole || st?.role || "Staff",
        startAt,
        endAt,
        notes: shiftNotes?.trim() || "",
      });

      setEditShift(null);
    } catch (e) {
      console.error("Edit shift failed:", e);
      alert("Couldn’t edit shift.");
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

  const viewBtn = (active) => ({
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    fontWeight: 900,
    cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
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

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tab === "staff" ? (
            <>
              <button onClick={() => setShowInactive(false)} style={toggleBtn(!showInactive)}>
                Active
              </button>
              <button onClick={() => setShowInactive(true)} style={toggleBtn(showInactive)}>
                All
              </button>
            </>
          ) : (
            <>
              <button style={viewBtn(rotaView === "list")} onClick={() => setRotaView("list")}>
                List
              </button>
              <button style={viewBtn(rotaView === "grid")} onClick={() => setRotaView("grid")}>
                Grid
              </button>
            </>
          )}
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 220px", gap: 12, marginTop: 14 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name e.g. Sam" style={inputStyle} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" style={inputStyle} />
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
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: "#111", fontSize: 15 }}>
                        {s.name} <span style={{ ...roleChip(s.role), marginLeft: 8 }}>{s.role || "Staff"}</span>{" "}
                        <span style={{ ...statusChip(s.active !== false), marginLeft: 8 }}>
                          {s.active !== false ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                        {s.email ? <span style={chip("#f3f4f6", "#111827")}>{s.email}</span> : <span style={chip("#fff7ed", "#9a3412")}>No email</span>}
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

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button style={toggleBtn(false)} onClick={() => setWeekStart((w) => addDays(w, -7))}>
                  ← Prev
                </button>
                <button style={toggleBtn(false)} onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
                  This week
                </button>
                <button style={toggleBtn(false)} onClick={() => setWeekStart((w) => addDays(w, 7))}>
                  Next →
                </button>

                <button
                  onClick={publishWeek}
                  disabled={busy}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #111827",
                    background: "#111827",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                  title="Mark all shifts this week as Published"
                >
                  <FaRegCalendarCheck /> Publish week
                </button>
              </div>
            </div>

            {/* LIST VIEW */}
            {rotaView === "list" ? (
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
                          {dayShifts.map((s) => {
                            const mailto = emailShiftLink(s);
                            return (
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

                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                  <button
                                    onClick={() => openEditShift(s)}
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
                                      color: "#111827",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    <FaPen /> Edit
                                  </button>

                                  {s.status !== "published" ? (
                                    <button
                                      onClick={() => setShiftStatus(s.id, "published")}
                                      disabled={busy}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "10px 12px",
                                        borderRadius: 12,
                                        border: "1px solid #16a34a",
                                        background: "#16a34a",
                                        cursor: busy ? "not-allowed" : "pointer",
                                        fontWeight: 900,
                                        color: "#fff",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Publish
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setShiftStatus(s.id, "draft")}
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
                                        color: "#111827",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Unpublish
                                    </button>
                                  )}

                                  {mailto ? (
                                    <a
                                      href={mailto}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "10px 12px",
                                        borderRadius: 12,
                                        border: "1px solid #e5e7eb",
                                        background: "#fff",
                                        fontWeight: 900,
                                        color: "#111827",
                                        whiteSpace: "nowrap",
                                        textDecoration: "none",
                                      }}
                                      title="Email this shift"
                                    >
                                      <FaEnvelope /> Email
                                    </a>
                                  ) : (
                                    <span style={{ ...chip("#fff7ed", "#9a3412"), height: 32, alignSelf: "center" }}>
                                      No email
                                    </span>
                                  )}

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
                                  >
                                    <FaTrashAlt /> Delete
                                  </button>
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
            ) : null}

            {/* GRID VIEW */}
            {rotaView === "grid" ? (
              <div style={{ marginTop: 14, overflowX: "auto" }}>
                <div style={{ minWidth: 980, border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "220px repeat(7, 1fr)",
                      background: "#f9fafb",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ padding: 12, fontWeight: 900, color: "#111827" }}>Staff</div>
                    {days.map((d) => (
                      <div key={isoDate(d)} style={{ padding: 12, fontWeight: 900, color: "#111827" }}>
                        {fmtDay(d)}
                      </div>
                    ))}
                  </div>

                  {activeStaff.length === 0 ? (
                    <div style={{ padding: 12, color: "#6b7280" }}>No active staff.</div>
                  ) : (
                    activeStaff.map((st) => {
                      const inner = shiftsByStaffByDay.get(st.id);
                      return (
                        <div
                          key={st.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "220px repeat(7, 1fr)",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          <div style={{ padding: 12 }}>
                            <div style={{ fontWeight: 900, color: "#111" }}>{st.name}</div>
                            <div style={{ marginTop: 6 }}>
                              <span style={roleChip(st.role)}>{st.role || "Staff"}</span>
                            </div>
                          </div>

                          {days.map((d) => {
                            const dayKey = isoDate(d);
                            const cellShifts = inner?.get(dayKey) || [];
                            return (
                              <div key={dayKey} style={{ padding: 10, borderLeft: "1px solid #e5e7eb", minHeight: 64 }}>
                                <button
                                  onClick={() => openAddShiftForStaffDay(st.id, d)}
                                  style={{
                                    padding: "6px 8px",
                                    borderRadius: 10,
                                    border: "1px solid #e5e7eb",
                                    background: "#fff",
                                    cursor: "pointer",
                                    fontWeight: 900,
                                    fontSize: 12,
                                  }}
                                  title="Add shift for this person on this day"
                                >
                                  + Add
                                </button>

                                {cellShifts.length === 0 ? null : (
                                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                                    {cellShifts.map((s) => (
                                      <div
                                        key={s.id}
                                        style={{
                                          border: "1px solid #e5e7eb",
                                          borderRadius: 12,
                                          padding: 10,
                                          background: s.status === "published" ? "#ecfdf5" : "#fff7ed",
                                        }}
                                      >
                                        <div style={{ fontWeight: 900, fontSize: 12, color: "#111827" }}>
                                          {fmtTime(s.startAt)} – {fmtTime(s.endAt)}
                                        </div>
                                        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                          <button
                                            onClick={() => openEditShift(s)}
                                            style={{
                                              padding: "6px 8px",
                                              borderRadius: 10,
                                              border: "1px solid #e5e7eb",
                                              background: "#fff",
                                              cursor: "pointer",
                                              fontWeight: 900,
                                              fontSize: 12,
                                            }}
                                          >
                                            Edit
                                          </button>
                                          {s.status !== "published" ? (
                                            <button
                                              onClick={() => setShiftStatus(s.id, "published")}
                                              style={{
                                                padding: "6px 8px",
                                                borderRadius: 10,
                                                border: "1px solid #16a34a",
                                                background: "#16a34a",
                                                cursor: "pointer",
                                                fontWeight: 900,
                                                fontSize: 12,
                                                color: "#fff",
                                              }}
                                            >
                                              Publish
                                            </button>
                                          ) : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Add shift modal */}
          {showAddShift ? (
            <div style={overlayStyle} onClick={() => !busy && setShowAddShift(false)}>
              <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#111", fontSize: 16 }}>Add shift</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Draft until you publish</div>
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
                  <input value={shiftNotes} onChange={(e) => setShiftNotes(e.target.value)} placeholder="Notes (optional)" style={inputStyle} />
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
                  >
                    <FaPlus /> {busy ? "Saving..." : "Save shift"}
                  </button>
                </div>

                {!canSaveShift ? (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>End time must be after start time.</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Edit shift modal */}
          {editShift ? (
            <div style={overlayStyle} onClick={() => !busy && setEditShift(null)}>
              <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#111", fontSize: 16 }}>Edit shift</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Reassign / change times</div>
                  </div>
                  <button style={toggleBtn(false)} onClick={() => !busy && setEditShift(null)}>
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
                  <input value={shiftNotes} onChange={(e) => setShiftNotes(e.target.value)} placeholder="Notes (optional)" style={inputStyle} />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button style={toggleBtn(false)} onClick={() => !busy && setEditShift(null)}>
                    Cancel
                  </button>
                  <button
                    onClick={saveEditShift}
                    disabled={!canSaveEdit}
                    style={{
                      ...toggleBtn(false),
                      background: canSaveEdit ? "#2563eb" : "#93c5fd",
                      border: "none",
                      color: "#fff",
                      cursor: canSaveEdit ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 900,
                    }}
                  >
                    <FaPen /> {busy ? "Saving..." : "Save changes"}
                  </button>
                </div>

                {!canSaveEdit ? (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>End time must be after start time.</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}