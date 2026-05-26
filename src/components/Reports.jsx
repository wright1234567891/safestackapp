import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import {
  FaArrowLeft,
  FaClipboardCheck,
  FaSnowflake,
  FaUsers,
  FaUserGraduate,
  FaThermometerHalf,
} from "react-icons/fa";

const Reports = ({ site, goBack }) => {
  const [equipment, setEquipment] = useState([]);
  const [staff, setStaff] = useState([]);
  const [trainingRecords, setTrainingRecords] = useState([]);
  const [fridgeBatches, setFridgeBatches] = useState([]);
  const [stockBatches, setStockBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const card = {
    background: "#fff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    border: "1px solid #e5e7eb",
  };

  const btn = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };

  useEffect(() => {
    if (!site) return;

    setLoading(true);
    const unsubs = [];

    const listenSite = (collectionName, setter) => {
      const qRef = query(collection(db, collectionName), where("site", "==", site));
      const unsub = onSnapshot(
        qRef,
        (snap) => setter(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
          console.error(`${collectionName} listener error:`, err);
          setter([]);
        }
      );
      unsubs.push(unsub);
    };

    const listenAll = (collectionName, setter) => {
      const unsub = onSnapshot(
        collection(db, collectionName),
        (snap) => setter(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
          console.error(`${collectionName} listener error:`, err);
          setter([]);
        }
      );
      unsubs.push(unsub);
    };

    listenSite("equipment", setEquipment);
    listenSite("trainingRecords", setTrainingRecords);
    listenSite("fridgeBatches", setFridgeBatches);
    listenSite("stockBatches", setStockBatches);
    listenAll("stafflogin", setStaff);

    setLoading(false);

    return () => unsubs.forEach((u) => u && u());
  }, [site]);

  const tempRecords = useMemo(() => {
    const rows = [];

    equipment.forEach((eq) => {
      const records = Array.isArray(eq.records) ? eq.records : [];

      records.forEach((record, index) => {
        rows.push({
          id: `${eq.id}-${index}`,
          equipmentName: eq.name || eq.type || "Equipment",
          equipmentType: eq.type || "",
          temp: record.temp ?? record.temperature ?? "",
          date: record.date || "",
          time: record.time || "",
          person: record.person || record.staffName || "",
        });
      });
    });

    return rows.reverse();
  }, [equipment]);

  if (loading) {
    return (
      <div style={{ padding: 30, textAlign: "center" }}>
        Loading reports...
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "'Inter', sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>
            Reports Dashboard
          </h1>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Site: {site || "All Sites"}
          </div>
        </div>

        {goBack && (
          <button onClick={goBack} style={btn}>
            <FaArrowLeft />
            Back
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div style={card}>
          <FaThermometerHalf color="#2563eb" size={24} />
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 10 }}>
            Temperature Records
          </div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>
            {tempRecords.length}
          </div>
        </div>

        <div style={card}>
          <FaUsers color="#16a34a" size={24} />
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 10 }}>
            Staff Members
          </div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>
            {staff.filter((s) => s.active !== false).length}
          </div>
        </div>

        <div style={card}>
          <FaUserGraduate color="#f97316" size={24} />
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 10 }}>
            Training Records
          </div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>
            {trainingRecords.filter((r) => r.deleted !== true).length}
          </div>
        </div>

        <div style={card}>
          <FaSnowflake color="#0891b2" size={24} />
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 10 }}>
            Fridge / Batch Logs
          </div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>
            {fridgeBatches.length + stockBatches.length}
          </div>
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 800,
            fontSize: 18,
            marginBottom: 14,
          }}
        >
          <FaClipboardCheck />
          Latest Temperature Records
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ textAlign: "left", padding: 10 }}>Equipment</th>
                <th style={{ textAlign: "left", padding: 10 }}>Temperature</th>
                <th style={{ textAlign: "left", padding: 10 }}>Date</th>
                <th style={{ textAlign: "left", padding: 10 }}>Time</th>
                <th style={{ textAlign: "left", padding: 10 }}>Staff</th>
              </tr>
            </thead>

            <tbody>
              {tempRecords.slice(0, 20).map((record) => (
                <tr key={record.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 10 }}>{record.equipmentName}</td>
                  <td style={{ padding: 10 }}>
                    {record.temp !== "" ? `${record.temp}°C` : "—"}
                  </td>
                  <td style={{ padding: 10 }}>{record.date || "—"}</td>
                  <td style={{ padding: 10 }}>{record.time || "—"}</td>
                  <td style={{ padding: 10 }}>{record.person || "—"}</td>
                </tr>
              ))}

              {tempRecords.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: 14, color: "#6b7280" }}>
                    No temperature records found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;