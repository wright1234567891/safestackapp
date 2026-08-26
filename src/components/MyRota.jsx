import React, { useEffect, useMemo, useState } from "react";
import {

  addDoc,

  collection,

  doc,

  onSnapshot,

  query,

  where,

  orderBy,

  Timestamp,

} from "firebase/firestore";
import { db } from "../firebase";
import { FaChevronLeft } from "react-icons/fa";

const SHIFTS_COLLECTION = "Shifts";
const HOLIDAY_COLLECTION = "HolidayRequests";
const STAFF_COLLECTION = "stafflogin";

const CURRENT_HOLIDAY_YEAR = new Date().getFullYear();
const DEFAULT_HOLIDAY_YEAR_START = `${CURRENT_HOLIDAY_YEAR}-01-01`;
const DEFAULT_HOLIDAY_YEAR_END = `${CURRENT_HOLIDAY_YEAR}-12-31`;

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

const inputStyle = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  fontSize: 14,
  outline: "none",
  width: "100%",
};

const startOfWeekMonday = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  return x;
};

const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const toDateInput = (d) => {
  const x = new Date(d);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const dateInputToTimestamp = (dateStr, endOfDay = false) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);

  return Timestamp.fromDate(dt);
};

const parseDateValue = (value, endOfDay = false) => {
  if (!value) return null;

  let parsed;

  if (value?.toDate) {
    parsed = value.toDate();
  } else if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const [year, month, day] = value.split("-").map(Number);
    parsed = new Date(year, month - 1, day);
  } else {
    parsed = new Date(value);
  }

  if (Number.isNaN(parsed.getTime())) return null;

  parsed.setHours(
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );

  return parsed;
};

const inclusiveCalendarDays = (start, end) => {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  return Math.floor((endUtc - startUtc) / 86400000) + 1;
};

const formatHours = (hours) =>
  Number(hours || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const fmtDay = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

const fmtDateLong = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const fmtTime = (ts) => {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function MyRota({ user, goBack }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlyPublished, setOnlyPublished] = useState(true);

  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayStart, setHolidayStart] = useState(() => toDateInput(new Date()));
  const [holidayEnd, setHolidayEnd] = useState(() => toDateInput(new Date()));
  const [holidayReason, setHolidayReason] = useState("");
  const [holidayHours, setHolidayHours] = useState("8");
  const [holidayBusy, setHolidayBusy] = useState(false);
  const [holidayRequests, setHolidayRequests] = useState([]);
  const [holidayProfile, setHolidayProfile] = useState(() => user || null);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const staffId = String(user?.id || user?.staffId || "").trim();
  const staffEmail = String(user?.email || "").trim().toLowerCase();
  const staffName = String(user?.name || "").trim().toLowerCase();

  const hasIdentity = !!staffId || !!staffEmail || !!staffName;

  useEffect(() => {
    if (!hasIdentity) {
      setHolidayProfile(null);
      return;
    }

    // The login object normally contains the holiday settings already. When
    // its document ID is available, subscribe only to that person's record so
    // a manager's toggle appears live without exposing other staff records.
    if (!staffId) return;

    const unsub = onSnapshot(
      doc(db, STAFF_COLLECTION, staffId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        setHolidayProfile({ id: snapshot.id, ...snapshot.data() });
      },
      (error) => {
        console.error("Holiday profile subscribe error:", error);
      }
    );

    return () => unsub();
  }, [hasIdentity, staffId]);

  useEffect(() => {
    if (!hasIdentity) {
      setShifts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const qRef = query(
      collection(db, SHIFTS_COLLECTION),
      where("startAt", ">=", Timestamp.fromDate(weekStart)),
      where("startAt", "<", Timestamp.fromDate(weekEnd)),
      orderBy("startAt", "asc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const myShifts = rows.filter((s) => {
          const shiftStaffId = String(s.staffId || "").trim();
          const shiftEmail = String(s.staffEmail || "").trim().toLowerCase();
          const shiftName = String(s.staffName || "").trim().toLowerCase();

          return (
            (staffId && shiftStaffId === staffId) ||
            (staffEmail && shiftEmail === staffEmail) ||
            (staffName && shiftName === staffName)
          );
        });

        setShifts(myShifts);
        setLoading(false);
      },
      (err) => {
        console.error("MyRota subscribe error:", err);
        setShifts([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [hasIdentity, staffId, staffEmail, staffName, weekStart, weekEnd]);

useEffect(() => {
  if (!hasIdentity) {
    setHolidayRequests([]);
    return;
  }

  const qRef = query(collection(db, HOLIDAY_COLLECTION));

  const unsub = onSnapshot(
    qRef,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const mine = rows.filter((r) => {
        const requestStaffId = String(r.staffId || "").trim();
        const requestEmail = String(r.staffEmail || "").trim().toLowerCase();
        const requestName = String(r.staffName || "").trim().toLowerCase();

        return (
          (staffId && requestStaffId === staffId) ||
          (staffEmail && requestEmail === staffEmail) ||
          (staffName && requestName === staffName)
        );
      });

      setHolidayRequests(mine);
    },
    (err) => {
      console.error(err);
      setHolidayRequests([]);
    }
  );

  return () => unsub();
}, [hasIdentity, staffId, staffEmail, staffName]);

  const approvedHolidayRequests = useMemo(
    () =>
      holidayRequests.filter(
        (request) =>
          String(request.status || "").toLowerCase() === "approved"
      ),
    [holidayRequests]
  );

  const holidayBalance = useMemo(() => {
    const yearStart = parseDateValue(
      holidayProfile?.holidayYearStart || DEFAULT_HOLIDAY_YEAR_START
    );
    const yearEnd = parseDateValue(
      holidayProfile?.holidayYearEnd || DEFAULT_HOLIDAY_YEAR_END,
      true
    );
    const entitlement = Math.max(
      0,
      Number(holidayProfile?.holidayEntitlementHours || 0)
    );
    const previouslyUsed = Math.max(
      0,
      Number(holidayProfile?.holidayHoursUsedBeforeTracking || 0)
    );

    const approvedHours = approvedHolidayRequests.reduce(
      (total, request) => {
        if (!yearStart || !yearEnd) return total;

        const requestStart = parseDateValue(request.startDate);
        const requestEnd = parseDateValue(request.endDate, true);
        const requestHours = Number(
          request.approvedHours ?? request.hoursRequested ?? 0
        );

        if (
          !requestStart ||
          !requestEnd ||
          !Number.isFinite(requestHours) ||
          requestHours <= 0 ||
          requestEnd < yearStart ||
          requestStart > yearEnd
        ) {
          return total;
        }

        const overlapStart = new Date(
          Math.max(requestStart.getTime(), yearStart.getTime())
        );
        const overlapEnd = new Date(
          Math.min(requestEnd.getTime(), yearEnd.getTime())
        );
        const totalDays = inclusiveCalendarDays(requestStart, requestEnd);
        const overlapDays = inclusiveCalendarDays(overlapStart, overlapEnd);

        if (totalDays <= 0 || overlapDays <= 0) return total;

        return total + requestHours * (overlapDays / totalDays);
      },
      0
    );

    const pendingHours = holidayRequests
      .filter(
        (request) =>
          String(request.status || "").toLowerCase() === "pending"
      )
      .reduce((total, request) => {
        const hours = Number(request.hoursRequested || 0);
        return total + (Number.isFinite(hours) && hours > 0 ? hours : 0);
      }, 0);

    const used = previouslyUsed + approvedHours;

    return {
      entitlement,
      previouslyUsed,
      approvedHours,
      pendingHours,
      used,
      remaining: entitlement - used,
      yearStart:
        holidayProfile?.holidayYearStart || DEFAULT_HOLIDAY_YEAR_START,
      yearEnd: holidayProfile?.holidayYearEnd || DEFAULT_HOLIDAY_YEAR_END,
    };
  }, [holidayProfile, approvedHolidayRequests, holidayRequests]);

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

  const canSubmitHoliday = useMemo(() => {
    if (holidayBusy) return false;
    if (!hasIdentity) return false;
    if (!holidayStart || !holidayEnd) return false;

    const start = new Date(holidayStart);
    const end = new Date(holidayEnd);
    const requestedHours = Number(holidayHours);

    return (
      end >= start &&
      Number.isFinite(requestedHours) &&
      requestedHours > 0
    );
  }, [
    holidayBusy,
    hasIdentity,
    holidayStart,
    holidayEnd,
    holidayHours,
  ]);

  const submitHolidayRequest = async () => {
    if (!canSubmitHoliday) return;

    setHolidayBusy(true);

    try {
      await addDoc(collection(db, HOLIDAY_COLLECTION), {
        staffId,
        staffName: user?.name || "",
        staffEmail,
        startDate: dateInputToTimestamp(holidayStart, false),
        endDate: dateInputToTimestamp(holidayEnd, true),
        hoursRequested: Number(holidayHours),
        reason: holidayReason.trim(),
        status: "pending",
        createdAt: Timestamp.now(),
      });

      setShowHolidayModal(false);
      setHolidayReason("");
      setHolidayHours("8");
      alert("Holiday request sent.");
    } catch (e) {
      console.error("Holiday request failed:", e);
      alert("Couldn’t send holiday request. Check Firestore permissions.");
    } finally {
      setHolidayBusy(false);
    }
  };

  const headerName = user?.name || "Your";

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
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

        <div style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>
          {headerName} rota
        </div>

        <span style={chip("#eef2ff", "#3730a3")}>
          Week: {fmtDay(weekStart)} → {fmtDay(addDays(weekStart, 6))}
        </span>
      </div>

      {holidayProfile?.holidayBalanceEnabled === true ? (
        <div
          style={{
            marginTop: 18,
            padding: 18,
            borderRadius: 16,
            border: "1px solid #bfdbfe",
            background: "linear-gradient(135deg, #eff6ff 0%, #ecfeff 100%)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
                Holiday hours
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>
                {holidayBalance.yearStart} to {holidayBalance.yearEnd} ·
                approved holiday only
              </div>
            </div>

            <span
              style={chip(
                holidayBalance.remaining >= 0 ? "#dcfce7" : "#fee2e2",
                holidayBalance.remaining >= 0 ? "#166534" : "#991b1b"
              )}
            >
              {formatHours(holidayBalance.remaining)}h remaining
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
              marginTop: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Entitlement</div>
              <div style={{ marginTop: 3, fontSize: 22, fontWeight: 900 }}>
                {formatHours(holidayBalance.entitlement)}h
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Used</div>
              <div style={{ marginTop: 3, fontSize: 22, fontWeight: 900 }}>
                {formatHours(holidayBalance.used)}h
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Left</div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 22,
                  fontWeight: 900,
                  color:
                    holidayBalance.remaining >= 0 ? "#166534" : "#991b1b",
                }}
              >
                {formatHours(holidayBalance.remaining)}h
              </div>
            </div>
          </div>

          <div
            style={{
              height: 9,
              marginTop: 14,
              overflow: "hidden",
              borderRadius: 999,
              background: "#dbeafe",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(
                  100,
                  Math.max(
                    0,
                    holidayBalance.entitlement > 0
                      ? (holidayBalance.used /
                          holidayBalance.entitlement) *
                          100
                      : 0
                  )
                )}%`,
                borderRadius: 999,
                background:
                  holidayBalance.remaining >= 0 ? "#2563eb" : "#dc2626",
              }}
            />
          </div>

          {holidayBalance.pendingHours > 0 ? (
            <div style={{ marginTop: 10, fontSize: 12, color: "#475569" }}>
              {formatHours(holidayBalance.pendingHours)}h are currently pending
              approval and have not been deducted yet.
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          ← Prev
        </button>

        <button
          onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          This week
        </button>

        <button
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Next →
        </button>

        <button
          onClick={() => setShowHolidayModal(true)}
          disabled={!hasIdentity}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #16a34a",
            background: hasIdentity ? "#16a34a" : "#86efac",
            color: "#fff",
            cursor: hasIdentity ? "pointer" : "not-allowed",
            fontWeight: 900,
          }}
        >
          Request holiday
        </button>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
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
          >
            {onlyPublished ? "Showing: Published" : "Showing: All"}
          </button>

          {loading ? (
            <span style={chip("#fef3c7", "#92400e")}>Loading…</span>
          ) : (
            <span style={chip("#f3f4f6", "#111827")}>
              {visibleShifts.length} shift(s)
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        {days.map((d) => {
          const key = fmtDay(d);
          const dayShifts = shiftsByDay.get(key) || [];

          const dayDate = new Date(d);
dayDate.setHours(12, 0, 0, 0);

const dayHolidays = approvedHolidayRequests.filter((h) => {
  const start = h.startDate?.toDate();
  const end = h.endDate?.toDate();

  if (!start || !end) return false;

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return dayDate >= start && dayDate <= end;
});

          return (
            <div
              key={key}
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 16,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 900, color: "#111" }}>
                  {fmtDateLong(d)}
                </div>

                <span style={chip("#f3f4f6", "#111827")}>
                  {dayShifts.length} shift(s)
                </span>
              </div>

              {dayHolidays.length > 0 && (
  <div style={{ marginTop: 10 }}>
    {dayHolidays.map((h) => (
      <div
        key={h.id}
        style={{
          background: "#dcfce7",
          color: "#166534",
          border: "1px solid #86efac",
          borderRadius: 12,
          padding: 12,
          marginBottom: 10,
          fontWeight: 800,
        }}
      >
        🌴 On approved holiday
      </div>
    ))}
  </div>
)}

              {dayShifts.length === 0 ? (
                <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>
                  No shifts.
                </div>
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {dayShifts.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: 12,
                        background:
                          String(s.status || "draft").toLowerCase() === "published"
                            ? "#ecfdf5"
                            : "#fff7ed",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 900, color: "#111827" }}>
                          {fmtTime(s.startAt)} – {fmtTime(s.endAt)}
                        </div>

                        <span style={chip("#eef2ff", "#3730a3")}>
                          {s.role || "Staff"}
                        </span>

                        {String(s.status || "draft").toLowerCase() === "published" ? (
                          <span style={chip("#dcfce7", "#166534")}>Published</span>
                        ) : (
                          <span style={chip("#fef9c3", "#854d0e")}>Draft</span>
                        )}

                        {s.location ? (
                          <span style={chip("#f3f4f6", "#111827")}>
                            {s.location}
                          </span>
                        ) : null}
                      </div>

                      {s.notes ? (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 12,
                            color: "#6b7280",
                          }}
                        >
                          {s.notes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!hasIdentity ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 14,
            border: "1px solid #fee2e2",
            background: "#fef2f2",
            color: "#991b1b",
            fontWeight: 800,
          }}
        >
          No user selected. Go back and select your name to view rota.
        </div>
      ) : null}

      {showHolidayModal ? (
        <div
          onClick={() => !holidayBusy && setShowHolidayModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              background: "#fff",
              borderRadius: 16,
              padding: 18,
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18, color: "#111" }}>
              Request holiday
            </div>

            <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>
              This will send a pending request for Chris/admin to approve.
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}>
                  Start date
                </label>
                <input
                  type="date"
                  value={holidayStart}
                  onChange={(e) => {
                    setHolidayStart(e.target.value);
                    if (holidayEnd < e.target.value) setHolidayEnd(e.target.value);
                  }}
                  style={{ ...inputStyle, marginTop: 6 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}>
                  End date
                </label>
                <input
                  type="date"
                  value={holidayEnd}
                  onChange={(e) => setHolidayEnd(e.target.value)}
                  style={{ ...inputStyle, marginTop: 6 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}>
                  Total holiday hours requested
                </label>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={holidayHours}
                  onChange={(e) => setHolidayHours(e.target.value)}
                  placeholder="e.g. 8"
                  style={{ ...inputStyle, marginTop: 6 }}
                />
                <div style={{ marginTop: 5, fontSize: 11, color: "#64748b" }}>
                  Enter the total paid holiday hours for the full date range.
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}>
                  Reason / note optional
                </label>
                <textarea
                  value={holidayReason}
                  onChange={(e) => setHolidayReason(e.target.value)}
                  placeholder="Optional note..."
                  rows={4}
                  style={{
                    ...inputStyle,
                    marginTop: 6,
                    resize: "vertical",
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => !holidayBusy && setShowHolidayModal(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: holidayBusy ? "not-allowed" : "pointer",
                  fontWeight: 900,
                }}
              >
                Cancel
              </button>

              <button
                onClick={submitHolidayRequest}
                disabled={!canSubmitHoliday}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "none",
                  background: canSubmitHoliday ? "#16a34a" : "#86efac",
                  color: "#fff",
                  cursor: canSubmitHoliday ? "pointer" : "not-allowed",
                  fontWeight: 900,
                }}
              >
                {holidayBusy ? "Sending..." : "Send request"}
              </button>
            </div>

            {!canSubmitHoliday ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                End date must be the same as or after start date, and holiday
                hours must be greater than zero.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
