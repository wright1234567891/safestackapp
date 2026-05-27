import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
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
  const [activeView, setActiveView] = useState("dashboard");
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
  const [reviewBatch, setReviewBatch] = useState(null);

const [reviewUseByDate, setReviewUseByDate] = useState("");

const [reviewStatus, setReviewStatus] = useState("active");
const [customGraphTitle, setCustomGraphTitle] = useState("Custom Report");
const [customChartType, setCustomChartType] = useState("line");

const [selectedMetrics, setSelectedMetrics] = useState(["tempExceptions"]);

const [graphPeriod, setGraphPeriod] = useState("week");

const [savedGraphs, setSavedGraphs] = useState([]);

  const toDate = (value) => {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;

    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
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

const dateFromRecordParts = (date, time = "00:00") => {
  if (!date) return null;

  // Handles UK dates like 27/05/2026
  if (typeof date === "string" && date.includes("/")) {
    const [day, month, year] = date.split("/");
    const fullYear = year?.length === 2 ? `20${year}` : year;
    const parsed = new Date(`${fullYear}-${month}-${day}T${time || "00:00"}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  // Handles ISO dates like 2026-05-27
  const parsed = new Date(`${date} ${time || "00:00"}`);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
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

  const isRecordDateInRange = (date, time) => {
    const cutoff = getCutoffDate();
    if (!cutoff) return true;

    const d = dateFromRecordParts(date, time);
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

    const listenSite = (collectionName, setter) => {
      const qRef = query(collection(db, collectionName), where("site", "==", site));

      const unsub = onSnapshot(
        qRef,
        (snap) => {
          setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (err) => {
          console.error(`${collectionName} reports listener error:`, err);
          setter([]);
        }
      );

      unsubs.push(unsub);
    };

    const listenAll = (collectionName, setter) => {
      const unsub = onSnapshot(
        collection(db, collectionName),
        (snap) => {
          setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (err) => {
          console.error(`${collectionName} reports listener error:`, err);
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

    return rows
      .filter((r) => isRecordDateInRange(r.date, r.time))
      .reverse();
  }, [equipment, dateRange]);

  const isTempException = (row) => {
    const n = Number(row.temp);
    if (!Number.isFinite(n)) return false;

    const type = String(row.equipmentType || row.equipmentName || "").toLowerCase();

    if (type.includes("fridge")) return n > 5;
    if (type.includes("freezer")) return n > -18;
    if (type.includes("hot")) return n < 63;

    return false;
  };

  const tempExceptions = useMemo(
    () => tempRecords.filter(isTempException),
    [tempRecords]
  );

  const checklistIssues = useMemo(() => {
    return completed
      .filter((c) => isInRange(c.createdAt))
      .filter((c) => {
        const questions = Array.isArray(c.questions) ? c.questions : [];

        return questions.some((q) => {
          if (q.corrective) return true;
          if (q.followUpAnswers?.yes?.corrective) return true;
          if (q.followUpAnswers?.no?.corrective) return true;
          return false;
        });
      });
  }, [completed, dateRange]);

const activeStockBatches = useMemo(() => {

  const validStockItemIds = new Set(stockItems.map((item) => item.id));

  return stockBatches.filter((b) => {

    const remaining = Number(b.quantityRemaining || 0);

    const isOpen = String(b.status || "").toLowerCase() !== "closed";

    const hasParentStockItem = validStockItemIds.has(b.stockItemId);

    return remaining > 0 && isOpen && hasParentStockItem;

  });

}, [stockBatches, stockItems]);

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

  const wasteByReason = useMemo(() => {
    const map = {};

    wasteLogs
      .filter((w) => isInRange(w.createdAt))
      .forEach((w) => {
        const reason = w.reason || "Other";
        map[reason] = (map[reason] || 0) + Number(w.qty || w.quantity || 1);
      });

    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [wasteLogs, dateRange]);

  const cleaningByTask = useMemo(() => {
    const map = {};

    cleaningRecords
      .filter((c) => isInRange(c.createdAt))
      .forEach((c) => {
        const task = c.task || c.area || "Cleaning";
        map[task] = (map[task] || 0) + 1;
      });

    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [cleaningRecords, dateRange]);

  const checklistCompletionByTitle = useMemo(() => {
    const map = {};

    completed
      .filter((c) => isInRange(c.createdAt))
      .forEach((c) => {
        const title = c.title || "Checklist";
        map[title] = (map[title] || 0) + 1;
      });

    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [completed, dateRange]);

  const tempByEquipment = useMemo(() => {
    const map = {};

    tempRecords.forEach((r) => {
      const name = r.equipmentName || "Equipment";

      if (!map[name]) {
        map[name] = {
          label: name,
          total: 0,
          exceptions: 0,
        };
      }

      map[name].total += 1;

      if (isTempException(r)) {
        map[name].exceptions += 1;
      }
    });

    return Object.values(map)
      .sort((a, b) => b.exceptions - a.exceptions || b.total - a.total)
      .slice(0, 8);
  }, [tempRecords]);

  const activeStaff = useMemo(
    () => staff.filter((s) => s.active !== false),
    [staff]
  );

  const filtered = {
    temps: tempRecords
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || isTempException(r)),

    stock: activeStockBatches
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || stockRisks.some((x) => x.id === r.id)),

    fridge: fridgeBatches
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || fridgeRisks.some((x) => x.id === r.id)),

    training: trainingRecords
      .filter((r) => r.deleted !== true)
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || trainingRisks.some((x) => x.id === r.id)),

    cleaning: cleaningRecords
      .filter((r) => isInRange(r.createdAt))
      .filter(textMatch),

    waste: wasteLogs
      .filter((r) => isInRange(r.createdAt))
      .filter(textMatch),

    checklists: completed
      .filter((r) => isInRange(r.createdAt))
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || checklistIssues.some((x) => x.id === r.id)),

    haccp: haccpPoints
      .filter(textMatch)
      .filter((r) => !exceptionsOnly || haccpAlerts.some((x) => x.id === r.id)),
  };

  const exportCSV = (rows, filename) => {
    if (!rows || rows.length === 0) return;

    const flatRows = rows.map((row) => {
      const out = {};

      Object.entries(row).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          out[key] = JSON.stringify(value);
        } else {
          out[key] = value;
        }
      });

      return out;
    });

    const headers = Object.keys(flatRows[0]);

    const escape = (value) => {
      const s = String(value ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csv = [
      headers.map(escape).join(","),
      ...flatRows.map((row) => headers.map((h) => escape(row[h])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  };
    const page = {
    maxWidth: 1220,
    margin: "0 auto",
    padding: "32px 20px",
    color: "#111827",
    fontFamily: "'Inter', system-ui, -apple-system, Arial",
  };

  const panel = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
  };

  const card = {
    ...panel,
    padding: 18,
  };

  const button = (active = false) => ({
    padding: "10px 14px",
    borderRadius: 12,
    border: active ? "1px solid #2563eb" : "1px solid #e5e7eb",
    background: active ? "#eff6ff" : "#fff",
    color: active ? "#1d4ed8" : "#111827",
    cursor: "pointer",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  });

  const pill = (label, tone = "neutral") => {
    const tones = {
      good: ["#dcfce7", "#166534"],
      warn: ["#fef3c7", "#92400e"],
      bad: ["#fee2e2", "#991b1b"],
      info: ["#dbeafe", "#1d4ed8"],
      neutral: ["#f3f4f6", "#374151"],
    };

    const [bg, fg] = tones[tone] || tones.neutral;

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "5px 10px",
          borderRadius: 999,
          background: bg,
          color: fg,
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        {label}
      </span>
    );
  };

  const StatCard = ({ title, value, icon, tone = "info", badge, onClick }) => {
    const colours = {
      info: "#2563eb",
      good: "#16a34a",
      warn: "#f97316",
      bad: "#dc2626",
      cold: "#0891b2",
      dark: "#111827",
    };

    return (
      <button
        onClick={onClick}
        style={{
          ...card,
          textAlign: "left",
          cursor: "pointer",
          minHeight: 150,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div>
            {badge && <div style={{ marginBottom: 12 }}>{badge}</div>}

            <div
              style={{
                color: "#6b7280",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              {title}
            </div>

            <div
              style={{
                fontSize: 38,
                lineHeight: 1,
                fontWeight: 950,
                marginTop: 4,
                color: "#111827",
              }}
            >
              {value}
            </div>
          </div>

          <div style={{ color: colours[tone] || colours.info, fontSize: 32 }}>
            {icon}
          </div>
        </div>
      </button>
    );
  };

  const BarChart = ({ title, data, valueLabel = "count", onClick }) => {
  const max = Math.max(...data.map((d) => Number(d.value || d.total || 0)), 1);


  return (
    <div style={{ ...card, minHeight: 300 }}>
      <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 14, color: "#111827" }}>
        {title}
      </div>

      {data.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          No data in this period.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {data.map((item) => {
            const value = Number(item.value || item.total || 0);
            const width = `${Math.max((value / max) * 100, 6)}%`;

            return (
              <button
                key={item.label}
                onClick={onClick}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  cursor: onClick ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                  <span>{item.label}</span>
                  <span>{value} {valueLabel}</span>
                </div>

                <div style={{ width: "100%", height: 12, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      width,
                      height: "100%",
                      background: item.exceptions > 0 ? "#dc2626" : "#2563eb",
                      borderRadius: 999,
                    }}
                  />
                </div>

                {item.exceptions > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {pill(`${item.exceptions} exception(s)`, "bad")}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CustomGraphBuilder = ({ title, data }) => {
  const metrics = [
    { key: "tempExceptions", label: "Temp exceptions", color: "#dc2626" },
    { key: "stockRisks", label: "Stock risks", color: "#f97316" },
    { key: "checklistIssues", label: "Checklist issues", color: "#2563eb" },
    { key: "wasteEntries", label: "Waste entries", color: "#7c3aed" },
  ];

  const activeMetrics = metrics.filter((m) => selectedMetrics.includes(m.key));

  const width = 720;
  const height = 280;
  const pad = 36;

  const max = Math.max(
    1,
    ...data.flatMap((d) => activeMetrics.map((m) => Number(d[m.key] || 0)))
  );

  const x = (i) => pad + (i * (width - pad * 2)) / Math.max(data.length - 1, 1);
  const y = (v) => height - pad - (v / max) * (height - pad * 2);

  const toggleMetric = (key) => {
    setSelectedMetrics((prev) =>
      prev.includes(key)
        ? prev.filter((m) => m !== key)
        : [...prev, key]
    );
  };

  return (
    <div style={{ ...card, minHeight: 380 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Custom Graph Builder</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Choose what you want to compare. Keep related data together for clearer reports.
          </div>
        </div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
  <select value={graphPeriod} onChange={(e) => setGraphPeriod(e.target.value)} style={button()}>
    <option value="day">Per day</option>
    <option value="week">Per week</option>
    <option value="month">Per month</option>
    <option value="quarter">Per quarter</option>
  </select>

  <select
    value={customChartType}
    onChange={(e) => setCustomChartType(e.target.value)}
    style={button()}
  >
    <option value="line">Line chart</option>
    <option value="bar">Bar chart</option>
  </select>

  <button
    style={button()}
onClick={async () => {
  await addDoc(collection(db, "customReports"), {
    site,
    title: customGraphTitle || "Custom Report",
    chartType: customChartType,
    period: graphPeriod,
    metrics: selectedMetrics,
    enabledOnDashboard: false,
    createdAt: serverTimestamp(),
  });

  alert("Custom report saved.");
}}
  >
    Save graph
  </button>
</div>
      </div>

      <input
        value={customGraphTitle}
        onChange={(e) => setCustomGraphTitle(e.target.value)}
        placeholder="Graph title"
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          marginBottom: 12,
          fontWeight: 800,
        }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {metrics.map((metric) => (
          <button
            key={metric.key}
            onClick={() => toggleMetric(metric.key)}
            style={{
              padding: "9px 12px",
              borderRadius: 999,
              border: selectedMetrics.includes(metric.key)
                ? `1px solid ${metric.color}`
                : "1px solid #e5e7eb",
              background: selectedMetrics.includes(metric.key) ? "#f8fafc" : "#fff",
              color: selectedMetrics.includes(metric.key) ? metric.color : "#374151",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {selectedMetrics.includes(metric.key) ? "✓ " : ""}
            {metric.label}
          </button>
        ))}
      </div>

      {activeMetrics.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          Select at least one metric to build a graph.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>
            {customGraphTitle || title}
          </div>

          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
            {[0, 0.25, 0.5, 0.75, 1].map((p) => {
              const gy = pad + p * (height - pad * 2);
              return (
                <line
                  key={p}
                  x1={pad}
                  x2={width - pad}
                  y1={gy}
                  y2={gy}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              );
            })}

            {customChartType === "line" &&
              activeMetrics.map((metric) => (
                <polyline
                  key={metric.key}
                  points={data
                    .map((d, i) => `${x(i)},${y(Number(d[metric.key] || 0))}`)
                    .join(" ")}
                  fill="none"
                  stroke={metric.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

            {customChartType === "bar" &&
              data.map((d, i) =>
                activeMetrics.map((metric, metricIndex) => {
                  const barGroupWidth = 24;
                  const barWidth = barGroupWidth / activeMetrics.length;
                  const value = Number(d[metric.key] || 0);

                  return (
                    <rect
                      key={`${d.label}-${metric.key}`}
                      x={x(i) - barGroupWidth / 2 + metricIndex * barWidth}
                      y={y(value)}
                      width={barWidth - 2}
                      height={height - pad - y(value)}
                      fill={metric.color}
                      rx="3"
                    />
                  );
                })
              )}

            {data.map((d, i) => (
              <text
                key={d.label}
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
              >
                {d.label}
              </text>
            ))}
          </svg>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            {activeMetrics.map((metric) => (
              <span key={metric.key} style={{ fontSize: 12, fontWeight: 900, color: metric.color }}>
                ● {metric.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

  const DonutCard = ({ title, value, subtitle, tone = "info", onClick }) => {
    const colours = {
      info: "#2563eb",
      good: "#16a34a",
      warn: "#f97316",
      bad: "#dc2626",
      cold: "#0891b2",
    };

    return (
      <button
        onClick={onClick}
        style={{
          ...card,
          minHeight: 220,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: "50%",
              border: `12px solid ${colours[tone] || colours.info}`,
              display: "grid",
              placeItems: "center",
              margin: "0 auto 12px",
              background: "#fff",
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 950,
                color: "#111827",
              }}
            >
              {value}
            </span>
          </div>

          <div style={{ fontWeight: 950, color: "#111827" }}>
            {title}
          </div>

          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            {subtitle}
          </div>
        </div>
      </button>
    );
  };

  const DataTable = ({ columns, rows, emptyText = "No records found." }) => (
    <div
      style={{
        overflowX: "auto",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        background: "#fff",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          color: "#111827",
        }}
      >
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: "left",
                  padding: 12,
                  color: "#111827",
                  fontWeight: 950,
                  borderBottom: "1px solid #e5e7eb",
                  whiteSpace: "nowrap",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: 18,
                  color: "#6b7280",
                }}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={row.id || index}
                style={{
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: 12,
                      color: "#111827",
                      verticalAlign: "top",
                    }}
                  >
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
  const openBatchReview = (batch) => {
  setReviewBatch(batch);
  setReviewUseByDate(batch.useByDate || "");
  setReviewStatus(batch.status || "active");
};

const saveBatchReview = async () => {
  if (!reviewBatch?.id) return;

  await updateDoc(doc(db, "stockBatches", reviewBatch.id), {
    useByDate: reviewUseByDate || null,
    needsUseByReview: !reviewUseByDate,
    status: reviewStatus || "active",
    updatedAt: serverTimestamp(),
  });

  closeBatchReview();
};

const actionReviewedBatch = async (type) => {
  if (!reviewBatch?.id) return;

  const qty = Number(reviewBatch.quantityRemaining || 0);
  if (qty <= 0) return;

  const parentItem = stockItems.find((item) => item.id === reviewBatch.stockItemId);

  await updateDoc(doc(db, "stockBatches", reviewBatch.id), {
    quantityRemaining: 0,
    status: "closed",
    updatedAt: serverTimestamp(),
  });

  if (parentItem?.id) {
    await updateDoc(doc(db, "stockItems", parentItem.id), {
      quantity: increment(-qty),
      updatedAt: serverTimestamp(),
    });
  }

  await addDoc(collection(db, "stockMovements"), {
    stockItemId: reviewBatch.stockItemId || null,
    stockItemName: reviewBatch.stockItemName || reviewBatch.itemName || "",
    type,
    quantity: qty,
    measurement: reviewBatch.measurement || "unit",
    supplier: reviewBatch.supplier || null,
    location: reviewBatch.location || null,
    source: "reports-review",
    site,
    createdAt: serverTimestamp(),
  });

  if (type === "waste") {
    await addDoc(collection(db, "wasteLogs"), {
      site,
      item: reviewBatch.stockItemName || reviewBatch.itemName || "",
      qty,
      unit: reviewBatch.measurement || "unit",
      reason: "Stock risk review",
      notes: "Created from Reports review",
      stockItemId: reviewBatch.stockItemId || null,
      source: "reports-review",
      createdAt: serverTimestamp(),
    });
  }

  closeBatchReview();
};

const closeBatchReview = () => {
  setReviewBatch(null);
  setReviewUseByDate("");
  setReviewStatus("active");
};

const trendData = useMemo(() => {
  const getBucketCount = () => {
    if (graphPeriod === "day") return dateRange === "90" ? 30 : dateRange === "7" ? 7 : 14;
    if (graphPeriod === "week") return dateRange === "90" ? 12 : 6;
    if (graphPeriod === "month") return 6;
    if (graphPeriod === "quarter") return 4;
    return 6;
  };

  const buckets = [];
  const count = getBucketCount();

  for (let i = count - 1; i >= 0; i--) {
    const start = new Date();

    if (graphPeriod === "day") start.setDate(start.getDate() - i);
    if (graphPeriod === "week") start.setDate(start.getDate() - i * 7);
    if (graphPeriod === "month") {
      start.setMonth(start.getMonth() - i);
      start.setDate(1);
    }
    if (graphPeriod === "quarter") {
      start.setMonth(start.getMonth() - i * 3);
      start.setMonth(Math.floor(start.getMonth() / 3) * 3);
      start.setDate(1);
    }

    start.setHours(0, 0, 0, 0);

    const end = new Date(start);

    if (graphPeriod === "day") end.setDate(end.getDate());
    if (graphPeriod === "week") end.setDate(end.getDate() + 6);
    if (graphPeriod === "month") {
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    }
    if (graphPeriod === "quarter") {
      end.setMonth(end.getMonth() + 3);
      end.setDate(0);
    }

    end.setHours(23, 59, 59, 999);

    const inBucket = (value) => {
      const d = toDate(value);
      return d && d >= start && d <= end;
    };

    const tempInBucket = tempRecords.filter((r) => {
      const d = dateFromRecordParts(r.date, r.time);
      return d && d >= start && d <= end;
    });

    const label =
      graphPeriod === "month"
        ? start.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
        : graphPeriod === "quarter"
        ? `Q${Math.floor(start.getMonth() / 3) + 1} ${String(start.getFullYear()).slice(-2)}`
        : start.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });

    buckets.push({
      label,
      tempExceptions: tempInBucket.filter(isTempException).length,
      stockRisks: stockRisks.filter((s) => inBucket(s.createdAt) || inBucket(s.updatedAt)).length,
      checklistIssues: checklistIssues.filter((c) => inBucket(c.createdAt)).length,
      wasteEntries: wasteLogs.filter((w) => inBucket(w.createdAt)).length,
    });
  }

  return buckets;
}, [dateRange, graphPeriod, tempRecords, stockRisks, checklistIssues, wasteLogs]);

    const DetailPanel = () => {
    if (activeView === "temps") {
      return (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <h2 style={{ fontSize: 22, fontWeight: 950, margin: 0 }}>Temperature Records</h2>
            {pill(`${tempExceptions.length} outside limits`, tempExceptions.length ? "bad" : "good")}
          </div>

          <DataTable
            rows={filtered.temps}
            columns={[
              { key: "equipmentName", label: "Equipment" },
              {
                key: "temp",
                label: "Temp",
                render: (r) => (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span>{r.temp !== "" ? `${r.temp}°C` : "—"}</span>
                    {isTempException(r) && pill("Alert", "bad")}
                  </div>
                ),
              },
              { key: "date", label: "Date" },
              { key: "time", label: "Time" },
              { key: "person", label: "Staff" },
            ]}
          />
        </div>
      );
    }

    if (activeView === "stock") {
      return (
        <div style={card}>
          <h2 style={{ fontSize: 22, fontWeight: 950, marginTop: 0 }}>Stock at Risk</h2>
          <DataTable
            rows={filtered.stock}
            columns={[
              { key: "stockItemName", label: "Item", render: (r) => r.stockItemName || r.itemName || "—" },
              { key: "quantityRemaining", label: "Remaining" },
              { key: "measurement", label: "Unit" },
              { key: "supplier", label: "Supplier" },
              { key: "useByDate", label: "Use-by", render: (r) => r.useByDate || "—" },
                {
  key: "risk",
  label: "Risk",
  render: (r) => {
    const days = daysUntil(r.useByDate);

    if (!r.useByDate || r.needsUseByReview) {
      return pill("Review", "warn");
    }

    if (days <= 1) {
      return pill("Critical", "bad");
    }

    if (days <= 3) {
      return pill("Soon", "warn");
    }

    return pill("OK", "good");
  },
},

{
  key: "review",
  label: "Review",
  render: (r) => (
    <button
      onClick={() => openBatchReview(r)}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #2563eb",
        background: "#eff6ff",
        color: "#1d4ed8",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      Review
    </button>
  ),
},
            ]}
          />
        </div>
      );
    }

    if (activeView === "fridge") {
      return (
        <div style={card}>
          <h2 style={{ fontSize: 22, fontWeight: 950, marginTop: 0 }}>Fridge Batches</h2>
          <DataTable
            rows={filtered.fridge}
            columns={[
              { key: "itemName", label: "Item" },
              { key: "equipmentName", label: "Location" },
              { key: "useBy", label: "Use-by", render: (r) => formatDate(r.useBy) },
              { key: "status", label: "Status", render: (r) => r.status || "IN_USE" },
              { key: "notes", label: "Notes" },
            ]}
          />
        </div>
      );
    }

    if (activeView === "training") {
      return (
        <div style={card}>
          <h2 style={{ fontSize: 22, fontWeight: 950, marginTop: 0 }}>Training Records</h2>
          <DataTable
            rows={filtered.training}
            columns={[
              {
                key: "staffId",
                label: "Staff",
                render: (r) => staff.find((s) => s.id === r.staffId)?.name || r.staffName || "—",
              },
              { key: "course", label: "Course", render: (r) => r.course || r.courseName || "—" },
              { key: "provider", label: "Provider" },
              { key: "completedOn", label: "Completed", render: (r) => formatDate(r.completedOn) },
              { key: "expiresOn", label: "Expires", render: (r) => formatDate(r.expiresOn) },
              {
                key: "status",
                label: "Status",
                render: (r) => {
                  const days = daysUntil(r.expiresOn);
                  if (!r.expiresOn) return pill("No expiry", "neutral");
                  if (days < 0) return pill("Expired", "bad");
                  if (days <= 30) return pill(`Expires ${days}d`, "warn");
                  return pill("Valid", "good");
                },
              },
            ]}
          />
        </div>
      );
    }

    if (activeView === "cleaning") {
      return (
        <div style={card}>
          <h2 style={{ fontSize: 22, fontWeight: 950, marginTop: 0 }}>Cleaning Records</h2>
          <DataTable
            rows={filtered.cleaning}
            columns={[
              { key: "task", label: "Task" },
              { key: "frequency", label: "Frequency" },
              { key: "area", label: "Area" },
              { key: "person", label: "Staff" },
              { key: "createdAt", label: "Date", render: (r) => formatDate(r.createdAt) },
              { key: "notes", label: "Notes" },
            ]}
          />
        </div>
      );
    }

    if (activeView === "waste") {
      return (
        <div style={card}>
          <h2 style={{ fontSize: 22, fontWeight: 950, marginTop: 0 }}>Waste Logs</h2>
          <DataTable
            rows={filtered.waste}
            columns={[
              { key: "item", label: "Item", render: (r) => r.item || r.itemName || "—" },
              { key: "qty", label: "Qty", render: (r) => r.qty || r.quantity || "—" },
              { key: "unit", label: "Unit" },
              { key: "reason", label: "Reason" },
              { key: "estimatedCost", label: "Est. Cost", render: (r) => r.estimatedCost ? `£${Number(r.estimatedCost).toFixed(2)}` : "—" },
              { key: "createdAt", label: "Date", render: (r) => formatDate(r.createdAt) },
            ]}
          />
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return <div style={{ padding: 30, textAlign: "center" }}>Loading reports...</div>;
  }

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 950, margin: 0 }}>Reports Dashboard</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>Site: {site || "All Sites"}</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {goBack && (
            <button style={button()} onClick={goBack}>
              <FaArrowLeft /> Back
            </button>
          )}
          <button
            style={button()}
            onClick={() => exportCSV(filtered[activeView] || filtered.temps, `${activeView}-report.csv`)}
          >
            <FaDownload /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 260, ...panel, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <FaSearch color="#6b7280" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dashboard..."
            style={{ border: "none", outline: "none", width: "100%", color: "#111827" }}
          />
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          style={{ ...button(), minWidth: 150 }}
        >
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
          <option value="all">All Time</option>
        </select>

        <button style={button(exceptionsOnly)} onClick={() => setExceptionsOnly((v) => !v)}>
          <FaFilter /> Exceptions Only
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 18 }}>
        <StatCard title="Temp Exceptions" value={tempExceptions.length} tone={tempExceptions.length ? "bad" : "good"} icon={<FaThermometerHalf />} badge={pill("Temperature", "info")} onClick={() => setActiveView("temps")} />
        <StatCard title="Stock Risks" value={stockRisks.length} tone={stockRisks.length ? "warn" : "good"} icon={<FaWarehouse />} badge={pill("Stock", "neutral")} onClick={() => setActiveView("stock")} />
        <StatCard title="Training Due" value={trainingRisks.length} tone={trainingRisks.length ? "warn" : "good"} icon={<FaUserGraduate />} badge={pill("Staff", "good")} onClick={() => setActiveView("training")} />
        <StatCard title="HACCP Alerts" value={haccpAlerts.length} tone={haccpAlerts.length ? "bad" : "good"} icon={<FaShieldAlt />} badge={pill("HACCP", haccpAlerts.length ? "bad" : "good")} onClick={() => setActiveView("haccp")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 18 }}>
        <DonutCard title="Completed Checks" value={completed.filter((c) => isInRange(c.createdAt)).length} subtitle="within selected date range" tone="info" onClick={() => setActiveView("checklists")} />
        <DonutCard title="Cleaning Records" value={cleaningRecords.filter((c) => isInRange(c.createdAt)).length} subtitle="cleaning activity" tone="good" onClick={() => setActiveView("cleaning")} />
        <DonutCard title="Waste Entries" value={wasteLogs.filter((w) => isInRange(w.createdAt)).length} subtitle="logged waste records" tone="warn" onClick={() => setActiveView("waste")} />
        <DonutCard title="Active Staff" value={activeStaff.length} subtitle="current active staff" tone="cold" onClick={() => setActiveView("training")} />
      </div>

{activeView === "dashboard" && (

  <>

    <div style={{ marginBottom: 16 }}>

<CustomGraphBuilder title={customGraphTitle} data={trendData} />
{savedGraphs.length > 0 && (
  <div style={{ ...card, marginTop: 12 }}>
    <div style={{ fontWeight: 950, marginBottom: 10 }}>Saved Graphs</div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {savedGraphs.map((graph, index) => (
        <button
          key={`${graph.title}-${index}`}
          style={button()}
          onClick={() => {
            setCustomGraphTitle(graph.title);
            setCustomChartType(graph.chartType);
            setGraphPeriod(graph.period);
            setSelectedMetrics(graph.metrics);
          }}
        >
          {graph.title}
        </button>
      ))}
    </div>
  </div>
)}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>

      <BarChart title="Temperature Checks by Equipment" data={tempByEquipment.map((x) => ({ label: x.label, value: x.total, exceptions: x.exceptions }))} valueLabel="checks" onClick={() => setActiveView("temps")} />

      <BarChart title="Checklist Completion" data={checklistCompletionByTitle} valueLabel="completed" onClick={() => setActiveView("checklists")} />

      <BarChart title="Cleaning by Task" data={cleaningByTask} valueLabel="records" onClick={() => setActiveView("cleaning")} />

      <BarChart title="Waste by Reason" data={wasteByReason} valueLabel="qty" onClick={() => setActiveView("waste")} />

    </div>

  </>

)}

      {activeView !== "dashboard" && (
        <div style={{ marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={button(activeView === "dashboard")} onClick={() => setActiveView("dashboard")}>Dashboard</button>
          <button style={button(activeView === "temps")} onClick={() => setActiveView("temps")}>Temps</button>
          <button style={button(activeView === "stock")} onClick={() => setActiveView("stock")}>Stock</button>
          <button style={button(activeView === "fridge")} onClick={() => setActiveView("fridge")}>Fridge</button>
          <button style={button(activeView === "training")} onClick={() => setActiveView("training")}>Training</button>
          <button style={button(activeView === "cleaning")} onClick={() => setActiveView("cleaning")}>Cleaning</button>
          <button style={button(activeView === "waste")} onClick={() => setActiveView("waste")}>Waste</button>
        </div>
      )}

      <DetailPanel />
      {reviewBatch && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.45)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 16,
    }}
  >
    <div
      style={{
        background: "#fff",
        borderRadius: 18,
        padding: 22,
        width: "min(520px, 100%)",
        boxShadow: "0 20px 45px rgba(15,23,42,0.25)",
        color: "#111827",
      }}
    >
      <h2 style={{ fontSize: 24, fontWeight: 950, marginTop: 0 }}>
        Review Stock Batch
      </h2>

      <div style={{ marginBottom: 14 }}>
        <strong>Item:</strong>{" "}
        {reviewBatch.stockItemName || reviewBatch.itemName || "Unnamed item"}
      </div>

      <div style={{ marginBottom: 14 }}>
        <strong>Remaining:</strong>{" "}
        {reviewBatch.quantityRemaining} {reviewBatch.measurement || ""}
      </div>

      <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>
        Use-by date
      </label>

      <input
        type="date"
        value={reviewUseByDate}
        onChange={(e) => setReviewUseByDate(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          marginBottom: 14,
        }}
      />

      <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>
        Batch status
      </label>

      <select
        value={reviewStatus}
        onChange={(e) => setReviewStatus(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          marginBottom: 18,
        }}
      >
        <option value="active">Active</option>
        <option value="closed">Closed</option>
      </select>

<div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
  <button
    onClick={closeBatchReview}
    style={{
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      background: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    }}
  >
    Cancel
  </button>

  <button
    onClick={() => actionReviewedBatch("usage")}
    style={{
      padding: "10px 14px",
      borderRadius: 12,
      border: "none",
      background: "#f97316",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    }}
  >
    Use Remaining
  </button>

  <button
    onClick={() => actionReviewedBatch("waste")}
    style={{
      padding: "10px 14px",
      borderRadius: 12,
      border: "none",
      background: "#ef4444",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    }}
  >
    Waste Remaining
  </button>

  <button
    onClick={saveBatchReview}
    style={{
      padding: "10px 14px",
      borderRadius: 12,
      border: "none",
      background: "#16a34a",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
    }}
  >
    Save Review
  </button>
</div>
    </div>
  </div>
)}
    </div>
  );
};

export default Reports;