// src/components/SitePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  FaMapMarkerAlt,
  FaChevronRight,
  FaPlus,
  FaClipboardCheck,
  FaThermometerHalf,
  FaBroom,
  FaDrumstickBite,
  FaBoxes,
  FaChartBar,
  FaExclamationTriangle,
  FaTools,
  FaUtensils,
  FaUserGraduate,
} from "react-icons/fa";

import { db } from "../firebase";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";

import EquipmentManager from "./EquipmentManager";
import ChecklistSection from "./ChecklistSection";
import TempSection from "./TempSection";
import CleaningSection from "./CleaningSection";
import CookingSection from "./CookingSection";
import StockSection from "./StockSection";
import Reports from "./Reports";
import CCPSection from "./CCPSection";
import HaccpDashboard from "./HaccpDashboard";
import DishesSection from "./DishesSection";
import StaffTrainingSection from "./StaffTrainingSection";

const sites = [
  "Thorganby Site",
  "Street Food Trailer",
  "Newsholme Site",
  "Pop up Locations",
];

// ---- Small date helpers ----
const toDate = (ts) => (ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null);
const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const withinLastDays = (d, days) => {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - (days - 1)); // inclusive window
  from.setHours(0, 0, 0, 0);
  const dd = toDate(d);
  return dd ? dd >= from && dd <= now : false;
};
const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// Simple chip style
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

// Donut progress (pure SVG)
const Donut = ({ size = 130, stroke = 12, percent = 0, label = "" }) => {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#2563eb"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, color: "#111" }}>
          {Math.round(clamped)}%
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>{label}</div>
      </div>
    </div>
  );
};

const SitePage = ({ user, onLogout }) => {
  const [selectedSite, setSelectedSite] = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  // Existing local states
  const [checklists, setChecklists] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [tempChecks, setTempChecks] = useState([]);
  const [cleaningRecords, setCleaningRecords] = useState([]);

  // NEW: Overview mode toggle (ALL | DAILY | WEEKLY | MONTHLY)
  const [overviewMode, setOverviewMode] = useState("ALL");

  // --- Live subscriptions for checklist overview (per selectedSite) ---
  useEffect(() => {
    if (!selectedSite) return;

    const qCL = query(
      collection(db, "checklists"),
      where("site", "==", selectedSite),
      orderBy("createdAt", "desc")
    );
    const unsubCL = onSnapshot(
      qCL,
      (snap) => setChecklists(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setChecklists([])
    );

    const qDone = query(
      collection(db, "completed"),
      where("site", "==", selectedSite),
      orderBy("createdAt", "desc")
    );
    const unsubDone = onSnapshot(
      qDone,
      (snap) => setCompleted(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setCompleted([])
    );

    return () => {
      unsubCL();
      unsubDone();
    };
  }, [selectedSite]);

  // --- Compute “due” vs “done” by frequency ---
  const overview = useMemo(() => {
    const today = new Date();

    const getLatestForChecklist = (cl) => {
      const title = (cl.title || "").trim().toLowerCase();
      const matches = completed.filter(
        (c) =>
          (c.checklistId && c.checklistId === cl.id) ||
          (!c.checklistId && (c.title || "").trim().toLowerCase() === title)
      );
      if (!matches.length) return null;
      matches.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      return matches[0]?.createdAt || null;
    };

    const buckets = {
      daily: { total: 0, done: 0 },
      weekly: { total: 0, done: 0 },
      monthly: { total: 0, done: 0 },
    };

    for (const cl of checklists) {
      const freq = (cl.frequency || "Ad hoc").toLowerCase();
      if (!["daily", "weekly", "monthly"].includes(freq)) continue;

      const latest = getLatestForChecklist(cl);
      const latestDate = latest ? toDate(latest) : null;

      if (freq === "daily") {
        buckets.daily.total += 1;
        if (latestDate && isSameDay(latestDate, today)) buckets.daily.done += 1;
      } else if (freq === "weekly") {
        buckets.weekly.total += 1;
        if (latestDate && withinLastDays(latestDate, 7)) buckets.weekly.done += 1;
      } else if (freq === "monthly") {
        buckets.monthly.total += 1;
        if (latestDate && sameMonth(latestDate, today)) buckets.monthly.done += 1;
      }
    }

    // Scope by overviewMode
    let totalDue = 0;
    let totalDone = 0;
    let label = "";

    switch (overviewMode) {
      case "DAILY":
        totalDue = buckets.daily.total;
        totalDone = buckets.daily.done;
        label = totalDue ? `Daily: ${totalDone}/${totalDue}` : "No daily due";
        break;
      case "WEEKLY":
        totalDue = buckets.weekly.total;
        totalDone = buckets.weekly.done;
        label = totalDue ? `Weekly: ${totalDone}/${totalDue}` : "No weekly due";
        break;
      case "MONTHLY":
        totalDue = buckets.monthly.total;
        totalDone = buckets.monthly.done;
        label = totalDue ? `Monthly: ${totalDone}/${totalDue}` : "No monthly due";
        break;
      default: {
        totalDue = buckets.daily.total + buckets.weekly.total + buckets.monthly.total;
        totalDone = buckets.daily.done + buckets.weekly.done + buckets.monthly.done;
        label = totalDue ? `${totalDone}/${totalDue} done` : "All clear";
      }
    }

    const percent = totalDue ? (totalDone / totalDue) * 100 : 100;
    return { buckets, totalDue, totalDone, percent, label };
  }, [checklists, completed, overviewMode]);

  const resetSite = () => {
    setSelectedSite(null);
    setActiveSection(null);
    setChecklists([]);
    setCompleted([]);
  };

  // Section routing
  if (selectedSite && activeSection === "equipment") {
    return (
      <EquipmentManager
        goBack={() => setActiveSection(null)}
        tempChecks={tempChecks}
        setTempChecks={setTempChecks}
        site={selectedSite}
        user={user}
      />
    );
  }
  if (selectedSite && activeSection === "checklists") {
    return (
      <ChecklistSection
        goBack={() => setActiveSection(null)}
        checklists={checklists}
        setChecklists={setChecklists}
        completed={completed}
        setCompleted={setCompleted}
        site={selectedSite}
        user={user}
      />
    );
  }
  if (selectedSite && activeSection === "temp") {
    const siteTempChecks = tempChecks.filter(
      (e) =>
        e.site === selectedSite &&
        (e.type === "Fridge" || e.type === "Freezer")
    );
    return (
      <TempSection
        goBack={() => setActiveSection(null)}
        tempChecks={siteTempChecks}
        setTempChecks={setTempChecks}
        site={selectedSite}
        user={user}
      />
    );
  }
  if (selectedSite && activeSection === "cleaning") {
    return (
      <CleaningSection
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
        cleaningRecords={cleaningRecords}
        setCleaningRecords={setCleaningRecords}
      />
    );
  }
  if (selectedSite && activeSection === "cooking") {
    const cookingEquipment = tempChecks.filter(
      (e) => e.site === selectedSite && e.type === "Cooking"
    );
    return (
      <CookingSection
        goBack={() => setActiveSection(null)}
        cookingEquipment={cookingEquipment}
        setTempChecks={setTempChecks}
        site={selectedSite}
        user={user}
      />
    );
  }
  if (selectedSite && activeSection === "stock") {
    return (
      <StockSection
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
      />
    );
  }
  if (selectedSite && activeSection === "reports") {
    return (
      <Reports
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
      />
    );
  }
  if (selectedSite && activeSection === "ccp") {
    return (
      <CCPSection
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
      />
    );
  }
  if (selectedSite && activeSection === "haccpDashboard") {
    return (
      <HaccpDashboard
        goBack={() => setActiveSection(null)}
        site={selectedSite}
      />
    );
  }
  if (selectedSite && activeSection === "dishes") {
    return (
      <DishesSection
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
      />
    );
  }
  if (selectedSite && activeSection === "training") {
    return (
      <StaffTrainingSection
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
      />
    );
  }

  // Site selection screen
  if (!selectedSite) {
    return (
      <div
        style={{
          maxWidth: "500px",
          margin: "0 auto",
          padding: "40px 20px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <h1
          style={{
            fontSize: "30px",
            fontWeight: "700",
            marginBottom: "25px",
            color: "#111",
            textAlign: "center",
          }}
        >
          Venues
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {sites.map((site) => (
            <div
              key={site}
              onClick={() => setSelectedSite(site)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#fff",
                borderRadius: "12px",
                padding: "16px 20px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#f9fafb")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#fff")
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <FaMapMarkerAlt size={20} color="#ef4444" />
                <div>
                  <div
                    style={{
                      fontWeight: "600",
                      fontSize: "16px",
                      color: "#111",
                    }}
                  >
                    {site}
                  </div>
                  <div style={{ fontSize: "13px", color: "#666" }}>
                    Tap to enter venue
                  </div>
                </div>
              </div>
              <FaChevronRight size={16} color="#999" />
            </div>
          ))}

          <div
            onClick={() => alert("Setup new venue flow coming soon")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#fff",
              borderRadius: "12px",
              padding: "16px 20px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#f9fafb")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#fff")
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <FaPlus size={18} color="#555" />
              <div
                style={{
                  fontWeight: "600",
                  fontSize: "16px",
                  color: "#111",
                }}
              >
                Set up a new venue
              </div>
            </div>
            <FaChevronRight size={16} color="#999" />
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            marginTop: "30px",
            width: "100%",
            padding: "12px 20px",
            borderRadius: "10px",
            cursor: "pointer",
            backgroundColor: "#ff5f5f",
            fontSize: "16px",
            color: "#fff",
            border: "none",
            fontWeight: "600",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#ff3f3f")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#ff5f5f")
          }
        >
          Logout
        </button>
      </div>
    );
  }

  // Dashboard with overview + icon cards
  const sections = [
    { label: "Checklists", key: "checklists", icon: <FaClipboardCheck size={24} color="#2563eb" /> },
    { label: "Temp Checks", key: "temp", icon: <FaThermometerHalf size={24} color="#ef4444" /> },
    { label: "Cleaning", key: "cleaning", icon: <FaBroom size={24} color="#10b981" /> },
    { label: "Cooking & Cooling", key: "cooking", icon: <FaDrumstickBite size={24} color="#f59e0b" /> },
    { label: "Stock", key: "stock", icon: <FaBoxes size={24} color="#6366f1" /> },
    { label: "Reports", key: "reports", icon: <FaChartBar size={24} color="#9333ea" /> },
    { label: "Dishes", key: "dishes", icon: <FaUtensils size={24} color="#0ea5e9" /> },
    { label: "Staff Training", key: "training", icon: <FaUserGraduate size={24} color="#0ea5e9" /> },
    { label: "HACCP Dashboard", key: "haccpDashboard", icon: <FaExclamationTriangle size={24} color="#16a34a" /> },
    { label: "CCPs", key: "ccp", icon: <FaExclamationTriangle size={24} color="#dc2626" /> },
    { label: "Add Equipment", key: "equipment", icon: <FaTools size={24} color="#374151" /> },
  ];

  const { buckets, totalDue, totalDone, percent, label } = overview;

  // Toggle button style
  const toggleBtn = (active) => ({
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: active ? "#2563eb" : "#fff",
    color: active ? "#fff" : "#111",
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "30px",
          marginBottom: "20px",
          color: "#111",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {selectedSite}
      </h1>

      {/* ==== Checklist Overview Card with Toggle ==== */}
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          marginBottom: 22,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 16,
          alignItems: "center",
        }}
      >
        <Donut percent={percent} label={label} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#111" }}>
              Checklist Overview
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setOverviewMode("ALL")}
                style={toggleBtn(overviewMode === "ALL")}
                onMouseEnter={(e) => overviewMode !== "ALL" && (e.currentTarget.style.backgroundColor = "#f9fafb")}
                onMouseLeave={(e) => overviewMode !== "ALL" && (e.currentTarget.style.backgroundColor = "#fff")}
              >
                All
              </button>
              <button
                onClick={() => setOverviewMode("DAILY")}
                style={toggleBtn(overviewMode === "DAILY")}
                onMouseEnter={(e) => overviewMode !== "DAILY" && (e.currentTarget.style.backgroundColor = "#f9fafb")}
                onMouseLeave={(e) => overviewMode !== "DAILY" && (e.currentTarget.style.backgroundColor = "#fff")}
              >
                Daily
              </button>
              <button
                onClick={() => setOverviewMode("WEEKLY")}
                style={toggleBtn(overviewMode === "WEEKLY")}
                onMouseEnter={(e) => overviewMode !== "WEEKLY" && (e.currentTarget.style.backgroundColor = "#f9fafb")}
                onMouseLeave={(e) => overviewMode !== "WEEKLY" && (e.currentTarget.style.backgroundColor = "#fff")}
              >
                Weekly
              </button>
              <button
                onClick={() => setOverviewMode("MONTHLY")}
                style={toggleBtn(overviewMode === "MONTHLY")}
                onMouseEnter={(e) => overviewMode !== "MONTHLY" && (e.currentTarget.style.backgroundColor = "#f9fafb")}
                onMouseLeave={(e) => overviewMode !== "MONTHLY" && (e.currentTarget.style.backgroundColor = "#fff")}
              >
                Monthly
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={chip("#ecfeff", "#075985")}>
              Daily: <strong>{buckets.daily.done}/{buckets.daily.total}</strong>
            </span>
            <span style={chip("#f5f3ff", "#5b21b6")}>
              Weekly: <strong>{buckets.weekly.done}/{buckets.weekly.total}</strong>
            </span>
            <span style={chip("#fef3c7", "#92400e")}>
              Monthly: <strong>{buckets.monthly.done}/{buckets.monthly.total}</strong>
            </span>
            {totalDue === 0 && (
              <span style={chip("#e5e7eb", "#111827")}>
                No scheduled checklists
              </span>
            )}
          </div>

          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Done counts include checklists completed in the correct window (today / last 7 days / this month).  
            Tip: add <code style={{ background:"#f3f4f6", padding:"0 4px", borderRadius:4 }}>checklistId</code> to completed docs for perfect matching.
          </div>

          <div style={{ marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveSection("checklists")}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
            >
              Open Checklists
            </button>
          </div>
        </div>
      </div>

      {/* Icon cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "20px",
        }}
      >
        {sections.map((sec) => (
          <div
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            style={{
              background: "#fff",
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              transition: "all 0.2s ease",
            }}
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
          >
            <div style={{ marginBottom: "10px" }}>{sec.icon}</div>
            <div
              style={{
                fontWeight: "600",
                fontSize: "15px",
                color: "#111",
                textAlign: "center",
              }}
            >
              {sec.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "40px",
          display: "flex",
          gap: "16px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={resetSite}
          style={{
            padding: "12px 24px",
            borderRadius: "10px",
            cursor: "pointer",
            backgroundColor: "#f3f4f6",
            fontSize: "15px",
            fontWeight: 500,
            border: "none",
            transition: "all 0.25s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#e0e3e8")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#f3f4f6")
          }
        >
          Back
        </button>
        <button
          onClick={onLogout}
          style={{
            padding: "12px 24px",
            borderRadius: "10px",
            cursor: "pointer",
            backgroundColor: "#ff5f5f",
            fontSize: "15px",
            color: "#fff",
            fontWeight: 500,
            border: "none",
            transition: "all 0.25s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#ff3f3f")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#ff5f5f")
          }
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default SitePage;