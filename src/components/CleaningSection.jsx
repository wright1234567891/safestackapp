// src/components/CleaningSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import {
  FaBroom,
  FaPlus,
  FaTrash,
  FaSearch,
  FaDownload,
  FaHome,
  FaClock,
  FaStickyNote,
} from "react-icons/fa";

// ----- Default task library -----
const defaultTasks = [
  "Griddle cleaned",
  "Hob cleaned",
  "Counter cleaned",
  "Floor cleaned",
  "Fridge/freezer cleaned",
  "Bins emptied",
];

// ----- Small helpers -----
const fmt = (ts) => (ts?.toDate ? ts.toDate() : null);
const isSameDay = (d1, d2) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const CleaningSection = ({ goBack, site, user, cleaningRecords = [], setCleaningRecords }) => {
  const [taskChoice, setTaskChoice] = useState("");
  const [customTask, setCustomTask] = useState("");
  const [frequency, setFrequency] = useState("Daily");
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ----- Styles (match Stock / Checklist) -----
  const wrap = {
    maxWidth: "980px",
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "'Inter', system-ui, -apple-system, Arial",
    color: "#111",
  };
  const title = { fontSize: "28px", fontWeight: 700, marginBottom: 22, textAlign: "center" };
  const card = {
    background: "#fff",
    borderRadius: "14px",
    padding: "18px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    marginBottom: "18px",
  };
  const sectionHeader = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 700,
    fontSize: "16px",
    marginBottom: "14px",
  };
  const row = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };
  const input = {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    minWidth: "200px",
    background: "#fff",
  };
  const textArea = { ...input, minWidth: "260px", minHeight: "40px" };
  const button = (bg = "#f3f4f6", fg = "#111") => ({
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    backgroundColor: bg,
    color: fg,
    fontWeight: 600,
    transition: "all .2s",
  });
  const primaryBtn = button("#22c55e", "#fff");
  const grayBtn = button();
  const redBtn = button("#ef4444", "#fff");
  const blueBtn = button("#2563eb", "#fff");

  const chip = (bg = "#eef2ff", fg = "#4338ca") => ({
    padding: "6px 10px",
    borderRadius: "999px",
    background: bg,
    color: fg,
    fontSize: "12px",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  });

  // ----- Firestore live data -----
  useEffect(() => {
    if (!site) return;
    const ref = collection(db, "cleaningRecords");
    const qy = query(ref, where("site", "==", site)); // removed orderBy
    const unsub = onSnapshot(qy, (snap) => {
      const recs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Client-side sort by createdAt (newest first)
      recs.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });
      setCleaningRecords(recs);
    });
    return () => unsub();
  }, [site, setCleaningRecords]);

  // ----- Add record -----
  const addRecord = async () => {
    const finalTask = (taskChoice || "").trim() || (customTask || "").trim();
    if (!finalTask) return;

    const record = {
      task: finalTask,
      frequency,
      area: area.trim() || null,
      notes: notes.trim() || null,
      person: typeof user === "string" ? user : user?.name || "Unknown",
      site,
      createdAt: Timestamp.now(),
    };

    try {
      await addDoc(collection(db, "cleaningRecords"), record);
      setTaskChoice("");
      setCustomTask("");
      setFrequency("Daily");
      setArea("");
      setNotes("");
    } catch (err) {
      console.error("Error adding cleaning record:", err);
    }
  };

  // ----- Delete (optional tidy-up) -----
  const deleteRecord = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await deleteDoc(doc(db, "cleaningRecords", id));
    } catch (err) {
      console.error("Error deleting record:", err);
    }
  };

  // ----- Filters & stats -----
  const filtered = useMemo(() => {
    let out = cleaningRecords || [];
    if (search.trim()) {
      const s = search.toLowerCase();
      out = out.filter(
        (r) =>
          r.task?.toLowerCase().includes(s) ||
          r.person?.toLowerCase().includes(s) ||
          r.area?.toLowerCase?.().includes(s) ||
          r.frequency?.toLowerCase?.().includes(s)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00");
      out = out.filter((r) => {
        const d = fmt(r.createdAt);
        return d ? d >= from : true;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59");
      out = out.filter((r) => {
        const d = fmt(r.createdAt);
        return d ? d <= to : true;
      });
    }
    return out;
  }, [cleaningRecords, search, dateFrom, dateTo]);

  const today = new Date();
  const last7 = new Date();
  last7.setDate(today.getDate() - 6);

  const stats = useMemo(() => {
    const total = cleaningRecords.length;
    const todayCount = cleaningRecords.filter((r) => {
      const d = fmt(r.createdAt);
      return d ? isSameDay(d, today) : false;
    }).length;
    const last7Count = cleaningRecords.filter((r) => {
      const d = fmt(r.createdAt);
      return d ? d >= new Date(last7.setHours(0, 0, 0, 0)) : false;
    }).length;

    return { total, today: todayCount, last7: last7Count };
  }, [cleaningRecords]);

  // ----- Export CSV (uses filtered view) -----
  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ["Task", "Frequency", "Area", "Notes", "Person", "Date", "Time"];
    const rows = filtered.map((r) => {
      const d = fmt(r.createdAt);
      const date = d ? d.toLocaleDateString() : "";
      const time = d ? d.toLocaleTimeString() : "";
      return [
        r.task ?? "",
        r.frequency ?? "",
        r.area ?? "",
        r.notes ?? "",
        r.person ?? "",
        date,
        time,
      ];
    });

    const escape = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv =
      headers.map(escape).join(",") +
      "\n" +
      rows.map((row) => row.map(escape).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${site}-cleaning-records.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ----- UI -----
  return (
    <div style={wrap}>
      <h2 style={title}>
        Cleaning — <span style={{ color: "#2563eb" }}>{site}</span>
      </h2>

      {/* Quick stats */}
      <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={chip("#ecfeff", "#0369a1")}>
            <FaClock /> Today
          </span>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{stats.today}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={chip("#f5f3ff", "#6d28d9")}>
            <FaClock /> Last 7 days
          </span>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{stats.last7}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={chip("#ecfccb", "#3f6212")}>
            <FaBroom /> Total
          </span>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{stats.total}</div>
        </div>
      </div>

      {/* Add record */}
      <div style={card}>
        <div style={sectionHeader}>
          <FaBroom color="#0ea5e9" />
          Add cleaning record
        </div>

        <div style={row}>
          <select
            value={taskChoice}
            onChange={(e) => setTaskChoice(e.target.value)}
            style={{ ...input, minWidth: 240 }}
            title="Choose a default task or leave blank to type your own"
          >
            <option value="">Select default task…</option>
            {defaultTasks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Or type a custom task"
            value={customTask}
            onChange={(e) => setCustomTask(e.target.value)}
            style={{ ...input, flex: 1, minWidth: 260 }}
          />

          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            style={{ ...input, minWidth: 160 }}
            title="Expected frequency"
          >
            <option>Daily</option>
            <option>Weekly</option>
            <option>Monthly</option>
            <option>Ad hoc</option>
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={chip("#eff6ff", "#1d4ed8")}>
              <FaHome />
              Area
            </span>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Grill Station A"
              style={{ ...input, minWidth: 220 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <span style={chip("#fef9c3", "#a16207")}>
              <FaStickyNote />
              Notes
            </span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              style={{ ...textArea, flex: 1 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={addRecord}
            style={primaryBtn}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#16a34a")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#22c55e")}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <FaPlus />
              Add Record
            </span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={card}>
        <div style={sectionHeader}>
          <FaSearch color="#2563eb" />
          Filter records
        </div>
        <div style={row}>
          <input
            type="text"
            placeholder="Search by task, person, area, frequency…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...input, flex: 1, minWidth: 260 }}
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ ...input, minWidth: 180 }}
            title="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ ...input, minWidth: 180 }}
            title="To date"
          />
          <button
            onClick={exportCSV}
            style={blueBtn}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
            title="Export filtered as CSV"
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <FaDownload />
              Export CSV
            </span>
          </button>
        </div>
      </div>

      {/* History */}
      <div style={card}>
        <div style={sectionHeader}>
          <FaClock color="#16a34a" />
          Cleaning history
        </div>

        {filtered.length === 0 ? (
          <div style={{ color: "#6b7280", padding: "12px" }}>No records match your filters.</div>
        ) : (
          <div style={{ borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ overflowX: "auto", maxHeight: 480 }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Task",
                      "Frequency",
                      "Area",
                      "Notes",
                      "Person",
                      "Date",
                      "Time",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          background: "#f9fafb",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rec, idx) => {
                    const d = fmt(rec.createdAt);
                    const date = d ? d.toLocaleDateString() : "";
                    const time = d ? d.toLocaleTimeString() : "";
                    return (
                      <tr
                        key={rec.id}
                        style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}
                      >
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          {rec.task}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          <span style={chip("#ecfeff", "#0369a1")}>{rec.frequency || "—"}</span>
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          {rec.area || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          {rec.notes || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          {rec.person}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          {date}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          {time}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            borderBottom: "1px solid #f1f5f9",
                            width: 1,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <button
                            onClick={() => deleteRecord(rec.id)}
                            style={redBtn}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#dc2626")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
                            title="Delete record"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Back */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <button
          onClick={goBack}
          style={grayBtn}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default CleaningSection;