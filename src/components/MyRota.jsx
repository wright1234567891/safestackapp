// src/components/MyRota.jsx
import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { FaChevronLeft } from "react-icons/fa";

// IMPORTANT: match your actual collection name EXACTLY (case-sensitive)
const SHIFTS_COLLECTION = "Shifts"; // change to "shifts" if that's what you use

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

const pad2 = (n) => String(n).padStart(2, "0");

const startOfWeekMonday = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun ... 6 Sat
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  return x;
};

const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const fmtDay = (d) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

const fmtDateLong = (d) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

const fmtTime = (ts) => {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

export default function MyRota({ user, goBack }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlyPublished, setOnlyPublished] = useState(true);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // user should be the "selected staff" from your dropdown login
  // Needs: user.id (staff doc id) and user.name ideally
  const staffId = user?.id || "";

  useEffect(() => {
    if (!staffId) return;

    setLoading(true);

    // Query: this staff member, this week, sorted by start time
    // NOTE: requires Firestore composite index if you add more where() later.
    const qRef = query(
      collection(db, SHIFTS_COLLECTION),
      where("staffId", "==", staffId),
      where("startAt", ">=", Timestamp.fromDate(weekStart)),
      where("startAt", "<", Timestamp.fromDate(weekEnd)),
      orderBy("startAt", "asc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setShifts(rows);
        setLoading(false);
      },
      (err) => {
        console.error("MyRota subscribe error:", err);
        setShifts([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [staffId, weekStart, weekEnd]);

  const visibleShifts = useMemo(() => {
    if (!onlyPublished) return shifts;
    return shifts.filter((s) => String(s.status || "draft").toLowerCase() === "published");
  }, [shifts, onlyPublished]);

  const shiftsByDay = useMemo(() => {
    const map = new Map();
    days.forEach((d) => map.set(fmtDay(d), []));
    for (const s of visibleShifts) {
      const d = s.startAt?.toDate?.() ? s.startAt.toDate() : null;
      if (!d) continue;
      const key = fmtDay(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return map;
  }, [days, visibleShifts]);

  const headerName = user?.name || "Your";

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

        <div style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>{headerName} rota</div>
        <span style={chip("#eef2ff", "#3730a3")}>
          Week: {fmtDay(weekStart)} → {fmtDay(addDays(weekStart, 6))}
        </span>
      </div>

      {/* Controls */}
      <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 900 }}
        >
          ← Prev
        </button>

        <button
          onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 900 }}
        >
          This week
        </button>

        <button
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 900 }}
        >
          Next →
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setOnlyPublished((v) => !v)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: onlyPublished ? "#111827" : "#fff",
              color: onlyPublished ? "#fff" : "#111827",
              cursor: "pointer",
              fontWeight: 900,
            }}
            title="Toggle draft shifts visibility"
          >
            {onlyPublished ? "Showing: Published" : "Showing: All (draft + published)"}
          </button>

          {loading ? <span style={chip("#fef3c7", "#92400e")}>Loading…</span> : <span style={chip("#f3f4f6", "#111827")}>{visibleShifts.length} shift(s)</span>}
        </div>
      </div>

      {/* Week list */}
      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        {days.map((d) => {
          const key = fmtDay(d);
          const dayShifts = shiftsByDay.get(key) || [];
          return (
            <div key={key} style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontWeight: 900, color: "#111" }}>{fmtDateLong(d)}</div>
                <span style={chip("#f3f4f6", "#111827")}>{dayShifts.length} shift(s)</span>
              </div>

              {dayShifts.length === 0 ? (
                <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>No shifts.</div>
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {dayShifts.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: 12,
                        background: String(s.status || "draft").toLowerCase() === "published" ? "#ecfdf5" : "#fff7ed",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontWeight: 900, color: "#111827" }}>
                          {fmtTime(s.startAt)} – {fmtTime(s.endAt)}
                        </div>

                        <span style={chip("#eef2ff", "#3730a3")}>{s.role || "Staff"}</span>

                        {String(s.status || "draft").toLowerCase() === "published" ? (
                          <span style={chip("#dcfce7", "#166534")}>Published</span>
                        ) : (
                          <span style={chip("#fef9c3", "#854d0e")}>Draft</span>
                        )}

                        {s.location ? <span style={chip("#f3f4f6", "#111827")}>{s.location}</span> : null}
                      </div>

                      {s.notes ? (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>{s.notes}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!staffId ? (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 14, border: "1px solid #fee2e2", background: "#fef2f2", color: "#991b1b", fontWeight: 800 }}>
          No user selected. Go back and select your name to view rota.
        </div>
      ) : null}
    </div>
  );
}