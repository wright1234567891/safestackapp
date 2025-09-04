// src/components/TempSection.jsx
import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import {
  FaThermometerHalf,
  FaSnowflake,
  FaPlus,
  FaArrowLeft,
  FaHistory,
} from "react-icons/fa";

const TempSection = ({ site, user, goBack }) => {
  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [newTemp, setNewTemp] = useState("");
  const [viewingRecord, setViewingRecord] = useState(null);

  // ====== Styles (aligned with Stock/Checklist) ======
  const wrap = {
    maxWidth: "980px",
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "'Inter', sans-serif",
    color: "#111",
  };

  const titleBar = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  };

  const title = { fontSize: "28px", fontWeight: 700, margin: 0 };
  const subtitle = { fontSize: 13, color: "#6b7280", marginTop: 4 };

  const card = {
    background: "#fff",
    borderRadius: "14px",
    padding: "18px 18px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    marginBottom: "18px",
  };

  const sectionHeader = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontWeight: 700,
    fontSize: "16px",
    marginBottom: "14px",
  };

  const row = {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
  };

  const input = {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    minWidth: "180px",
    background: "#fff",
  };

  const button = (bg = "#f3f4f6", fg = "#111") => ({
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    backgroundColor: bg,
    color: fg,
    fontWeight: 600,
    transition: "all .2s",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  });

  const primaryBtn = button("#22c55e", "#fff");
  const blueBtn = button("#2563eb", "#fff");
  const grayBtn = button();

  const grid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  };

  const eqCard = {
    background: "#fff",
    borderRadius: "14px",
    padding: "16px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    transition: "all 0.2s ease",
    cursor: "pointer",
  };

  const pill = (bg = "#eef2ff", fg = "#4338ca") => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 12,
    fontWeight: 700,
  });

  const tableWrap = {
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  };

  const table = {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    fontSize: "14px",
  };

  const th = {
    textAlign: "left",
    padding: "10px 12px",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  };

  const td = {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  };

  const smallNote = { fontSize: 12, color: "#6b7280" };

  // ====== Data ======
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const snapshot = await getDocs(collection(db, "equipment"));
        const data = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(
            (eq) =>
              eq.site === site &&
              (eq.type === "Fridge" || eq.type === "Freezer")
          );
        setEquipmentList(data);
      } catch (error) {
        console.error("Error fetching equipment:", error);
      }
    };
    fetchEquipment();
  }, [site]);

  const generateId = () =>
    "_" + Math.random().toString(36).slice(2, 11);

  const addRecord = async () => {
    const n = parseFloat(newTemp);
    if (Number.isNaN(n) || selectedEquipment == null) return;

    const now = new Date();
    const record = {
      id: generateId(),
      temp: n,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      person:
        typeof user === "string" ? user : user?.name || "Unknown",
    };

    try {
      const eqRef = doc(db, "equipment", selectedEquipment.id);
      const updatedRecords = [...(selectedEquipment.records || []), record];
      await updateDoc(eqRef, { records: updatedRecords });

      setEquipmentList((prev) =>
        prev.map((eq) =>
          eq.id === selectedEquipment.id
            ? { ...eq, records: updatedRecords }
            : eq
        )
      );
      setSelectedEquipment((prev) =>
        prev ? { ...prev, records: updatedRecords } : prev
      );
      setNewTemp("");
    } catch (error) {
      console.error("Error adding temperature record:", error);
    }
  };

  const viewRecord = (eq, rec) => {
    setViewingRecord({ equipment: eq, record: rec });
  };

  const resetView = () => {
    setSelectedEquipment(null);
    setViewingRecord(null);
    setNewTemp("");
  };

  // Quick stats for selected equipment
  const stats = useMemo(() => {
    const recs = selectedEquipment?.records || [];
    if (!recs.length) return null;
    const temps = recs.map((r) => Number(r.temp)).filter((x) => !Number.isNaN(x));
    if (!temps.length) return null;
    const avg =
      Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10;
    const last = recs[recs.length - 1];
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    return { avg, last, min, max };
  }, [selectedEquipment]);

  return (
    <div style={wrap}>
      {/* Header */}
      <div style={titleBar}>
        <div>
          <h2 style={title}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <FaThermometerHalf color="#2563eb" />
              Temperature Checks — <span style={{ color: "#2563eb" }}>{site}</span>
            </span>
          </h2>
          <div style={subtitle}>
            Log temperatures for fridges and freezers. Keep records tidy and consistent.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={goBack}
            style={grayBtn}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
          >
            <FaArrowLeft />
            Back
          </button>
        </div>
      </div>

      {/* Equipment list */}
      {!selectedEquipment && !viewingRecord && (
        <>
          <div style={card}>
            <div style={sectionHeader}>
              <FaSnowflake />
              Select equipment
            </div>

            {equipmentList.length === 0 ? (
              <div style={{ color: "#6b7280", textAlign: "center", padding: "16px 0" }}>
                No fridge/freezer equipment yet.
              </div>
            ) : (
              <div style={grid}>
                {equipmentList.map((eq) => (
                  <div
                    key={eq.id}
                    style={eqCard}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.12)";
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                      e.currentTarget.style.backgroundColor = "#fff";
                    }}
                    onClick={() => setSelectedEquipment(eq)}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{eq.name}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <span style={pill(eq.type === "Freezer" ? "#ecfeff" : "#eef2ff", eq.type === "Freezer" ? "#0ea5e9" : "#4338ca")}>
                        {eq.type}
                      </span>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        {(eq.records || []).length} record{(eq.records || []).length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {!!(eq.records || []).length && (
                      <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 6, alignItems: "center" }}>
                        <FaHistory />
                        Last: {
                          (() => {
                            const last = (eq.records || [])[ (eq.records || []).length - 1 ];
                            return last ? `${last.temp}° at ${last.time}` : "—";
                          })()
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Selected equipment – add record + list */}
      {selectedEquipment && !viewingRecord && (
        <>
          <div style={card}>
            <div style={sectionHeader}>
              <FaThermometerHalf />
              {selectedEquipment.name}
              <span style={pill(selectedEquipment.type === "Freezer" ? "#ecfeff" : "#eef2ff",
                                selectedEquipment.type === "Freezer" ? "#0ea5e9" : "#4338ca")}>
                {selectedEquipment.type}
              </span>
            </div>

            {/* Stats */}
            {stats && (
              <div style={{ ...row, marginBottom: 8, color: "#6b7280", fontSize: 13 }}>
                <span>Avg: <strong style={{ color: "#111" }}>{stats.avg}°</strong></span>
                <span>Min: <strong style={{ color: "#111" }}>{stats.min}°</strong></span>
                <span>Max: <strong style={{ color: "#111" }}>{stats.max}°</strong></span>
                <span>Last: <strong style={{ color: "#111" }}>{stats.last.temp}°</strong> at {stats.last.time}</span>
              </div>
            )}

            {/* Add record */}
            <div style={{ ...row, marginTop: 6 }}>
              <input
                type="number"
                step="0.1"
                placeholder="Temperature (°C)"
                value={newTemp}
                onChange={(e) => setNewTemp(e.target.value)}
                style={{ ...input, minWidth: 160 }}
              />
              <button
                onClick={addRecord}
                style={primaryBtn}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#16a34a")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#22c55e")}
                title="Add temperature record"
              >
                <FaPlus />
                Add Record
              </button>
              <button
                onClick={resetView}
                style={grayBtn}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
              >
                Back
              </button>
            </div>
          </div>

          {/* Records list */}
          <div style={card}>
            <div style={sectionHeader}>
              <FaHistory />
              Previous Records
            </div>

            {(selectedEquipment.records || []).length === 0 ? (
              <div style={{ color: "#6b7280" }}>No records yet — add the first one above.</div>
            ) : (
              <div style={tableWrap}>
                <div style={{ overflowX: "auto", maxHeight: 460 }}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={th}>Temp (°C)</th>
                        <th style={th}>Date</th>
                        <th style={th}>Time</th>
                        <th style={th}>Recorded by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedEquipment.records || []).map((rec) => (
                        <tr
                          key={rec.id}
                          onClick={() => viewRecord(selectedEquipment, rec)}
                          style={{ cursor: "pointer", background: "#fff" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
                        >
                          <td style={td}>{rec.temp}°</td>
                          <td style={td}>{rec.date}</td>
                          <td style={td}>{rec.time}</td>
                          <td style={td}>{rec.person}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "8px 12px", textAlign: "right" }}>
                  <span style={smallNote}>Tip: click a row to view details.</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Single record view */}
      {viewingRecord && (
        <div style={card}>
          <div style={sectionHeader}>
            <FaHistory />
            {viewingRecord.equipment.name} — Record
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div><div style={smallNote}>Temperature</div><div style={{ fontWeight: 700 }}>{viewingRecord.record.temp}°C</div></div>
            <div><div style={smallNote}>Date</div><div style={{ fontWeight: 700 }}>{viewingRecord.record.date}</div></div>
            <div><div style={smallNote}>Time</div><div style={{ fontWeight: 700 }}>{viewingRecord.record.time}</div></div>
            <div><div style={smallNote}>Recorded by</div><div style={{ fontWeight: 700 }}>{viewingRecord.record.person}</div></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              onClick={resetView}
              style={grayBtn}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TempSection;