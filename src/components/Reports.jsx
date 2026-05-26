import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import {
  FaArrowLeft,
  FaBroom,
  FaClipboardCheck,
  FaDownload,
  FaExclamationTriangle,
  FaFilter,
  FaSearch,
  FaShieldAlt,
  FaSnowflake,
  FaThermometerHalf,
  FaTrashAlt,
  FaUserGraduate,
  FaUsers,
  FaWarehouse,
} from "react-icons/fa";

const Reports = ({ site, goBack }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30");
  const [search, setSearch] = useState("");
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const [equipment, setEquipment] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [cleaningRecords, setCleaningRecords] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [stockBatches, setStockBatches] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [wasteLogs, setWasteLogs] = useState([]);
  const [fridgeBatches, setFridgeBatches] = useState([]);
  const [staff, setStaff] = useState([]);
  const [trainingRecords, setTrainingRecords] = useState([]);
  const [haccpPoints, setHaccpPoints] = useState([]);
  const [dishes, setDishes] = useState([]);

  const toDate = (value) => {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    if (typeof value === "string") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const formatDate = (value) => {
    const d = toDate(value);
    if (!d) return "—";
    return d.toLocaleDateString("en-GB");
  };

  const formatTime = (value) => {
    const d = toDate(value);
    if (!d) return "—";
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCutoffDate = () => {
    if (dateRange === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(dateRange));
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const isInRange = (value) => {
    const cutoff = getCutoffDate();
    if (!cutoff) return true;
    const d = toDate(value);
    if (!d) return true;
    return d >= cutoff;
  };

  const daysUntil = (value) => {
    const d = toDate(value);
    if (!d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  };

  const textMatch = (row) => {
    if (!search.trim()) return true;
    return JSON.stringify(row).toLowerCase().includes(search.toLowerCase());
  };

  useEffect(() => {
    if (!site) return;

    setLoading(true);
    const unsubs = [];

    const listenSite = (name, setter) => {
      const qRef = query(collection(db, name), where("site", "==", site));
      const unsub = onSnapshot(
        qRef,
        (snap) => setter(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
          console.error(`${name} report listener error:`, err);
          setter([]);
        }
      );
      unsubs.push(unsub);
    };

    const listenAll = (name, setter) => {
      const unsub = onSnapshot(
        collection(db, name),
        (snap) => setter(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
          console.error(`${name} report listener error:`, err);
          setter([]);
        }
      );
      unsubs.push(unsub);
    };

    listenSite("equipment", setEquipment);
    listenSite("completed", setCompleted);
    listenSite("cleaningRecords", setCleaningRecords);
    listenSite("stockItems", setStockItems);
    listenSite("stockBatches", setStockBatches);
    listenSite("stockMovements", setStockMovements);
    listenSite("wasteLogs", setWasteLogs);
    listenSite("fridgeBatches", setFridgeBatches);
    listenSite("trainingRecords", setTrainingRecords);
    listenSite("haccpPoints", setHaccpPoints);
    listenSite("dishes", setDishes);
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
          equipmentId: eq.id,
          equipmentName: eq.name || eq.type || "Equipment",
          equipmentType: eq.type || "",
          temp: record.temp ?? record.temperature ?? "",
          date: record.date || "",
          time: record.time || "",
          person: record.person || record.staffName || "",
          raw: record,
        });
      });
    });

    return rows.reverse();
  }, [equipment]);

  const tempExceptions = useMemo(() => {
    return tempRecords.filter((r) => {
      const n = Number(r.temp);
      if (!Number.isFinite(n)) return false;

      const type = String(r.equipmentType || "").toLowerCase();

      if (type.includes("fridge")) return n > 5;
      if (type.includes("freezer")) return n > -18;
      if (type.includes("hot")) return n < 63;

      return false;
    });
  }, [tempRecords]);

  const checklistIssues = useMemo(() => {
    return completed.filter((c) => {
      const questions = Array.isArray(c.questions) ? c.questions : [];

      return questions.some((q) => {
        if (q.corrective) return true;
        if (q.followUpAnswers?.yes?.corrective) return true;
        if (q.followUpAnswers?.no?.corrective) return true;
        return false;
      });
    });
  }, [completed]);

  const activeStockBatches = useMemo(() => {
    return stockBatches.filter(
      (b) =>
        Number(b.quantityRemaining || 0) > 0 &&
        String(b.status || "").toLowerCase() !== "closed"
    );
  }, [stockBatches]);

  const stockRisks = useMemo(() => {
    return activeStockBatches.filter((b) => {
      if (b.needsUseByReview || !b.useByDate) return true;
      const days = daysUntil(b.useByDate);
      return days !== null && days <= 3;
    });
  }, [activeStockBatches, dateRange]);

  const fridgeRisks = useMemo(() => {
    return fridgeBatches.filter((b) => {
      if (String(b.status || "").toUpperCase() === "DISCARDED") return false;
      const days = daysUntil(b.useBy);
      return days !== null && days <= 1;
    });
  }, [fridgeBatches, dateRange]);

  const trainingRisks = useMemo(() => {
    return trainingRecords.filter((t) => {
      if (t.deleted === true) return false;
      if (!t.expiresOn) return false;
      const days = daysUntil(t.expiresOn);
      return days !== null && days <= 30;
    });
  }, [trainingRecords, dateRange]);

  const haccpAlerts = useMemo(() => {
    return haccpPoints.filter((h) => {
      const linkedEquipmentIds = Array.isArray(h.equipmentIds)
        ? h.equipmentIds
        : [];

      return linkedEquipmentIds.some((eqId) => {
        const eq = equipment.find((e) => e.id === eqId);
        if (!eq || !Array.isArray(eq.records) || eq.records.length === 0) {
          return false;
        }

        const last = eq.records[eq.records.length - 1];
        const temp = Number(last.temp ?? last.temperature);

        if (!Number.isFinite(temp)) return false;

        const min = Number(h.limitMin);
        const max = Number(h.limitMax);

        if (Number.isFinite(min) && temp < min) return true;
        if (Number.isFinite(max) && temp > max) return true;

        return false;
      });
    });
  }, [haccpPoints, equipment]);

  const filteredRows = {
    temp: tempRecords
      .filter((r) => isInRange(r.date))
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || tempExceptions.some((e) => e.id === r.id)),

    checklists: completed
      .filter((r) => isInRange(r.createdAt))
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || checklistIssues.some((e) => e.id === r.id)),

    cleaning: cleaningRecords
      .filter((r) => isInRange(r.createdAt))
      .filter(textMatch),

    stock: stockItems
      .filter(textMatch),

    stockBatches: activeStockBatches
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || stockRisks.some((e) => e.id === r.id)),

    waste: wasteLogs
      .filter((r) => isInRange(r.createdAt))
      .filter(textMatch),

    fridge: fridgeBatches
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || fridgeRisks.some((e) => e.id === r.id)),

    training: trainingRecords
      .filter((r) => r.deleted !== true)
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || trainingRisks.some((e) => e.id === r.id)),

    haccp: haccpPoints
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || haccpAlerts.some((e) => e.id === r.id)),
  };

  const activeStaff = staff.filter((s) => s.active !== false);

  const exportCSV = (rows, filename) => {
    if (!rows || rows.length === 0) return;

    const headers = Object.keys(rows[0]);
    const escape = (value) => {
      const s = String(value ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csv = [
      headers.map(escape).join(","),
      ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const card = {
    background: "#fff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    border: "1px solid #e5e7eb",
  };

  const button = (active = false) => ({
    padding: "10px 13px",
    borderRadius: 10,
    border: active ? "1px solid #2563eb" : "1px solid #e5e7eb",
    background: active ? "#eff6ff" : "#fff",
    color: active ? "#1d4ed8" : "#111827",
    cursor: "pointer",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  });

  const riskPill = (label, level = "low") => {
    const colours = {
      low: ["#dcfce7", "#166534"],
      medium: ["#fef3c7", "#92400e"],
      high: ["#fee2e2", "#991b1b"],
      neutral: ["#e5e7eb", "#374151"],
    };

    const [bg, fg] = colours[level] || colours.neutral;

    return (
      <span
        style={{
          display: "inline-flex",
          padding: "4px 9px",
          borderRadius: 999,
          background: bg,
          color: fg,
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        {label}
      </span>
    );
  };

  const DataTable = ({ columns, rows, emptyText = "No records found." }) => (
    <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: "left", padding: 10 }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 14, color: "#6b7280" }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id || index} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: 10, verticalAlign: "top" }}>
                    {col.render ? col.render(row) : row[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
    if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 900,
              marginBottom: 4,
            }}
          >
            Reports Dashboard
          </h1>

          <p style={{ color: "#6b7280" }}>
            Site: {site || "All Sites"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {goBack && (
            <button style={button()} onClick={goBack}>
              <FaArrowLeft />
              Back
            </button>
          )}

          <button
            style={button()}
            onClick={() => exportCSV(filteredRows.temp, "temperature-report.csv")}
          >
            <FaDownload />
            Export CSV
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 220,
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
            padding: "10px 14px",
          }}
        >
          <FaSearch style={{ color: "#6b7280" }} />

          <input
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              width: "100%",
              background: "transparent",
            }}
          />
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "10px 14px",
            background: "#fff",
            fontWeight: 700,
          }}
        >
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
          <option value="all">All Time</option>
        </select>

        <button
          style={button(exceptionsOnly)}
          onClick={() => setExceptionsOnly(!exceptionsOnly)}
        >
          <FaFilter />
          Exceptions Only
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
        }}
      >
        <div style={card}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">
                Temperature Records
              </div>

              <div className="text-3xl font-black">
                {tempRecords.length}
              </div>

              <div className="mt-2">
                {riskPill(
                  `${tempExceptions.length} exceptions`,
                  tempExceptions.length > 0 ? "high" : "low"
                )}
              </div>
            </div>

            <FaThermometerHalf size={30} color="#2563eb" />
          </div>
        </div>

        <div style={card}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">
                Active Staff
              </div>

              <div className="text-3xl font-black">
                {activeStaff.length}
              </div>
            </div>

            <FaUsers size={30} color="#16a34a" />
          </div>
        </div>

        <div style={card}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">
                Training Expiring
              </div>

              <div className="text-3xl font-black">
                {trainingRisks.length}
              </div>

              <div className="mt-2">
                {riskPill(
                  trainingRisks.length > 0 ? "Attention Needed" : "Compliant",
                  trainingRisks.length > 0 ? "medium" : "low"
                )}
              </div>
            </div>

            <FaUserGraduate size={30} color="#ea580c" />
          </div>
        </div>

        <div style={card}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">
                HACCP Alerts
              </div>

              <div className="text-3xl font-black">
                {haccpAlerts.length}
              </div>

              <div className="mt-2">
                {riskPill(
                  haccpAlerts.length > 0 ? "Critical" : "Stable",
                  haccpAlerts.length > 0 ? "high" : "low"
                )}
              </div>
            </div>

            <FaShieldAlt size={30} color="#dc2626" />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          style={button(activeTab === "overview")}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>

        <button
          style={button(activeTab === "temps")}
          onClick={() => setActiveTab("temps")}
        >
          Temps
        </button>

        <button
          style={button(activeTab === "stock")}
          onClick={() => setActiveTab("stock")}
        >
          Stock
        </button>

        <button
          style={button(activeTab === "fridge")}
          onClick={() => setActiveTab("fridge")}
        >
          Fridge
        </button>

        <button
          style={button(activeTab === "training")}
          onClick={() => setActiveTab("training")}
        >
          Training
        </button>

        <button
          style={button(activeTab === "cleaning")}
          onClick={() => setActiveTab("cleaning")}
        >
          Cleaning
        </button>

        <button
          style={button(activeTab === "waste")}
          onClick={() => setActiveTab("waste")}
        >
          Waste
        </button>
      </div>

      {(activeTab === "overview" || activeTab === "temps") && (
        <div style={card}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              Temperature Records
            </h2>

            {riskPill(
              `${tempExceptions.length} outside limits`,
              tempExceptions.length > 0 ? "high" : "low"
            )}
          </div>

          <DataTable
            rows={filteredRows.temp}
            columns={[
              {
                key: "equipmentName",
                label: "Equipment",
              },
              {
                key: "temp",
                label: "Temperature",
                render: (row) => {
                  const temp = Number(row.temp);

                  let level = "low";

                  if (temp > 5) level = "high";

                  return (
                    <div className="flex items-center gap-2">
                      <span>{row.temp}°C</span>
                      {level === "high" &&
                        riskPill("Alert", "high")}
                    </div>
                  );
                },
              },
              {
                key: "date",
                label: "Date",
              },
              {
                key: "time",
                label: "Time",
              },
              {
                key: "person",
                label: "Staff",
              },
            ]}
          />
        </div>
      )}

      {(activeTab === "overview" || activeTab === "stock") && (
        <div style={card}>
          <div className="flex items-center gap-2 mb-4">
            <FaWarehouse />
            <h2 className="text-xl font-bold">
              Stock Batch Risks
            </h2>
          </div>

          <DataTable
            rows={filteredRows.stockBatches}
            columns={[
              {
                key: "itemName",
                label: "Item",
              },
              {
                key: "quantityRemaining",
                label: "Remaining",
              },
              {
                key: "useByDate",
                label: "Use By",
                render: (row) => formatDate(row.useByDate),
              },
              {
                key: "risk",
                label: "Risk",
                render: (row) => {
                  const days = daysUntil(row.useByDate);

                  if (days === null) {
                    return riskPill("Review", "medium");
                  }

                  if (days <= 1) {
                    return riskPill("Critical", "high");
                  }

                  if (days <= 3) {
                    return riskPill("Warning", "medium");
                  }

                  return riskPill("Good", "low");
                },
              },
            ]}
          />
        </div>
      )}

      {(activeTab === "overview" || activeTab === "fridge") && (
        <div style={card}>
          <div className="flex items-center gap-2 mb-4">
            <FaSnowflake />
            <h2 className="text-xl font-bold">
              Fridge Batch Tracking
            </h2>
          </div>

          <DataTable
            rows={filteredRows.fridge}
            columns={[
              {
                key: "itemName",
                label: "Item",
              },
              {
                key: "quantity",
                label: "Quantity",
              },
              {
                key: "useBy",
                label: "Use By",
                render: (row) => formatDate(row.useBy),
              },
              {
                key: "status",
                label: "Status",
              },
            ]}
          />
        </div>
      )}

      {(activeTab === "overview" || activeTab === "training") && (
        <div style={card}>
          <div className="flex items-center gap-2 mb-4">
            <FaUserGraduate />
            <h2 className="text-xl font-bold">
              Training Records
            </h2>
          </div>

          <DataTable
            rows={filteredRows.training}
            columns={[
              {
                key: "staffName",
                label: "Staff",
              },
              {
                key: "courseName",
                label: "Course",
              },
              {
                key: "completedOn",
                label: "Completed",
                render: (row) => formatDate(row.completedOn),
              },
              {
                key: "expiresOn",
                label: "Expires",
                render: (row) => formatDate(row.expiresOn),
              },
            ]}
          />
        </div>
      )}

      {(activeTab === "overview" || activeTab === "cleaning") && (
        <div style={card}>
          <div className="flex items-center gap-2 mb-4">
            <FaBroom />
            <h2 className="text-xl font-bold">
              Cleaning Records
            </h2>
          </div>

          <DataTable
            rows={filteredRows.cleaning}
            columns={[
              {
                key: "area",
                label: "Area",
              },
              {
                key: "staffName",
                label: "Staff",
              },
              {
                key: "createdAt",
                label: "Date",
                render: (row) => formatDate(row.createdAt),
              },
              {
                key: "createdAtTime",
                label: "Time",
                render: (row) => formatTime(row.createdAt),
              },
            ]}
          />
        </div>
      )}

      {(activeTab === "overview" || activeTab === "waste") && (
        <div style={card}>
          <div className="flex items-center gap-2 mb-4">
            <FaTrashAlt />
            <h2 className="text-xl font-bold">
              Waste Logs
            </h2>
          </div>

          <DataTable
            rows={filteredRows.waste}
            columns={[
              {
                key: "itemName",
                label: "Item",
              },
              {
                key: "quantity",
                label: "Qty",
              },
              {
                key: "reason",
                label: "Reason",
              },
              {
                key: "createdAt",
                label: "Date",
                render: (row) => formatDate(row.createdAt),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default Reports;