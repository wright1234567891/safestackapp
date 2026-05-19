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
  FaUserCheck,
  FaTrashAlt,
  FaRegCalendarCheck,
  FaHome,
  FaShieldAlt,
  FaBell,
  FaGripVertical,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { db } from "../firebase";
import {

  collection,

  onSnapshot,

  query,

  where,

  doc,

  getDoc,

  setDoc,

  updateDoc,

  serverTimestamp,

} from "firebase/firestore";

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
import StaffManager from "./StaffManager";
import FridgeLogSection from "./FridgeLogSection";
import WasteLogSection from "./WasteLogSection";
import HowToSection from "./HowToSection";
import MyRota from "./MyRota";

const sites = [
  { id: "thorganby", label: "Thorganby Site" },
  { id: "trailer", label: "Street Food Trailer" },
  { id: "newsholme", label: "Newsholme Site" },
  { id: "popups", label: "Pop up Locations" },
  { id: "micklegate", label: "50 Micklegate" },
];

const siteLabelForId = (id) => sites.find((s) => s.id === id)?.label ?? id;

const siteKeysForSelected = (selectedSite) => {
  if (!selectedSite) return [];
  const label = siteLabelForId(selectedSite);
  return Array.from(new Set([selectedSite, label].filter(Boolean)));
};

const COLLECTIONS = {
  completedChecklists: "completed",
  cleaningLogs: "cleaningRecords",
  stockBatches: "stockBatches",
};

const TEMP_LIMITS = {
  Fridge: { min: 0, max: 5 },
  Freezer: { max: -18 },
};

const toDate = (ts) => (ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null);

const isSameDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const withinLastDays = (d, days) => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const from = new Date(end);
  from.setDate(end.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  const dd = toDate(d);
  return dd ? dd >= from && dd <= end : false;
};

const sameMonth = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const isToday = (d) => {
  const dd = toDate(d);
  if (!dd) return false;
  const now = new Date();
  return isSameDay(dd, now);
};

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

const norm = (s = "") =>
  s
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");

const Donut = ({ size = 130, stroke = 12, percent = 0, label = "", color = "#15985f" }) => {
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
          stroke={color}
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
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{Math.round(clamped)}%</div>
        <div style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>{label}</div>
      </div>
    </div>
  );
};

const useIsMobile = (breakpoint = 820) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isMobile;
};

const buildChecklistsFromTemplates = (siteId, siteTemplateRows, templatesRows) => {
  const tplMap = new Map(templatesRows.map((t) => [t.id, t]));
  const enabledLinks = siteTemplateRows.filter((st) => st.enabled !== false);

  return enabledLinks
    .map((st) => {
      const tpl = tplMap.get(st.templateId);
      if (!tpl) return null;

      const questions = (tpl.questions || []).map((q) => {
        const o = st.overrides?.questions?.[q.id];
        return { ...q, enabled: o?.enabled ?? q.enabled ?? true };
      });

      return {
        id: tpl.id,
        site: siteId,
        title: st.overrides?.title || tpl.title,
        frequency: tpl.frequency || "Ad hoc",
        questions,
        _source: "template",
        _templateId: tpl.id,
      };
    })
    .filter(Boolean);
};

const SortableDashboardTile = ({ sec, openSection, editMode, enabled, toggleWidget }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sec.key,
  });

  const wrapperStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : "auto",
  };

  return (
    <div ref={setNodeRef} style={wrapperStyle}>
      <button
        className="tile-button"
        onClick={() => {
          if (!editMode) openSection(sec);
        }}
        style={{
          position: "relative",
          width: "100%",
          background: enabled ? "#fff" : "#f1f5f9",
          border: enabled ? "1px solid #e5e7eb" : "1px dashed #cbd5e1",
          borderRadius: 18,
          padding: "22px 16px",
          minHeight: 112,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: editMode ? "default" : "pointer",
          transition: "all 0.18s ease",
          color: enabled ? "#0f172a" : "#94a3b8",
          boxShadow: isDragging ? "0 12px 28px rgba(15,23,42,0.16)" : "0 2px 8px rgba(15,23,42,0.04)",
          opacity: enabled ? 1 : 0.55,
        }}
      >
        {editMode && (
          <>
            <span
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                width: 30,
                height: 30,
                borderRadius: 999,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                display: "grid",
                placeItems: "center",
                cursor: "grab",
                color: "#64748b",
              }}
              title="Drag to reorder"
            >
              <FaGripVertical />
            </span>

            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleWidget(sec.key);
              }}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                padding: "6px 9px",
                borderRadius: 999,
                background: enabled ? "#dcfce7" : "#fee2e2",
                color: enabled ? "#15803d" : "#dc2626",
                fontSize: 11,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
              }}
              title={enabled ? "Hide from dashboard" : "Show on dashboard"}
            >
              {enabled ? <FaEye /> : <FaEyeSlash />}
              {enabled ? "ON" : "OFF"}
            </span>
          </>
        )}

        <div style={{ fontSize: 26, color: enabled ? sec.color || "#0f172a" : "#94a3b8", marginBottom: 10 }}>
          {sec.icon}
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, textAlign: "center" }}>{sec.label}</div>
        {sec.helper && <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", textAlign: "center" }}>{sec.helper}</div>}
      </button>
    </div>
  );
};

const SitePage = ({ user, onLogout }) => {
  const isManager =
    (user?.role || "").toLowerCase() === "manager" ||
    ["chris", "chloe"].includes((user?.name || "").toLowerCase());

  const [selectedSite, setSelectedSite] = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [siteTemplates, setSiteTemplates] = useState([]);
  const [legacyChecklists, setLegacyChecklists] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [cleanLogs, setCleanLogs] = useState([]);
  const [stockBatches, setStockBatches] = useState([]);
  const [checklists, setChecklists] = useState([]);

  const [tempChecks, setTempChecks] = useState([]);
  const [cleaningRecords, setCleaningRecords] = useState([]);

  const [overviewMode, setOverviewMode] = useState("ALL");
  const [editDashboard, setEditDashboard] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState(null);

  const isMobile = useIsMobile();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const selectedSiteKeys = useMemo(() => siteKeysForSelected(selectedSite), [selectedSite]);
  const selectedSiteLabel = useMemo(() => (selectedSite ? siteLabelForId(selectedSite) : ""), [selectedSite]);

  const assumeMissingSiteAsThisVenue = selectedSite === "thorganby";

  const filterForSelectedSite = useMemo(() => {
    const keys = selectedSiteKeys;
    return (docData) => {
      const s = docData?.site;
      if (s && keys.includes(s)) return true;
      if (!s && assumeMissingSiteAsThisVenue) return true;
      return false;
    };
  }, [selectedSiteKeys, assumeMissingSiteAsThisVenue]);

  useEffect(() => {
    if (!selectedSite) return;

    const unsubSiteTemplates = onSnapshot(
      query(collection(db, "siteTemplates"), where("site", "==", selectedSite)),
      (snap) => setSiteTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setSiteTemplates([])
    );

    const unsubTemplates = onSnapshot(
      collection(db, "templates"),
      (snap) => setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setTemplates([])
    );

    const unsubLegacy = onSnapshot(
      collection(db, "checklists"),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(filterForSelectedSite);
        rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setLegacyChecklists(rows);
      },
      () => setLegacyChecklists([])
    );

    const unsubDone = onSnapshot(
      collection(db, COLLECTIONS.completedChecklists),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(filterForSelectedSite);
        rows.sort(
          (a, b) =>
            (b.completedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0) -
            (a.completedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0)
        );
        setCompleted(rows);
      },
      () => setCompleted([])
    );

    const unsubEquip = onSnapshot(
      collection(db, "equipment"),
      (snap) => setEquipment(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(filterForSelectedSite)),
      () => setEquipment([])
    );

    const unsubClean = onSnapshot(
      collection(db, COLLECTIONS.cleaningLogs),
      (snap) => setCleanLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(filterForSelectedSite)),
      () => setCleanLogs([])
    );

    const unsubStockBatches = onSnapshot(
      collection(db, COLLECTIONS.stockBatches),
      (snap) => setStockBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(filterForSelectedSite)),
      () => setStockBatches([])
    );

    return () => {
      unsubSiteTemplates();
      unsubTemplates();
      unsubLegacy();
      unsubDone();
      unsubEquip();
      unsubClean();
      unsubStockBatches();
    };
  }, [selectedSite, filterForSelectedSite]);

  useEffect(() => {
    if (!selectedSite) return;
    setChecklists(
      siteTemplates.length > 0
        ? buildChecklistsFromTemplates(selectedSite, siteTemplates, templates)
        : legacyChecklists
    );
  }, [selectedSite, siteTemplates, templates, legacyChecklists]);

  const overview = useMemo(() => {
    const today = new Date();

    const getLatestForChecklist = (cl) => {
      const t = norm(cl.title || "");
      const matches = completed.filter((c) => {
        const cid = c.checklistId || c.checklistRef || c.checklist_id;
        const tid = c.templateId;

        if (cl._source === "template" && tid && tid === cl.id) return true;
        if (cl._source !== "template" && cid && cid === cl.id) return true;

        const ct = norm(c.title || c.checklistTitle || "");
        return t && ct && ct === t;
      });

      if (!matches.length) return null;

      matches.sort(
        (a, b) =>
          (b.completedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0) -
          (a.completedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0)
      );

      return matches[0]?.completedAt || matches[0]?.createdAt || null;
    };

    const buckets = {
      daily: { total: 0, done: 0 },
      weekly: { total: 0, done: 0 },
      monthly: { total: 0, done: 0 },
    };

    checklists.forEach((cl) => {
      const freq = (cl.frequency || "Ad hoc").toString().trim().toLowerCase();
      if (!["daily", "weekly", "monthly"].includes(freq)) return;

      const latest = getLatestForChecklist(cl);
      const latestDate = latest ? toDate(latest) : null;

      buckets[freq].total += 1;

      if (freq === "daily" && latestDate && isSameDay(latestDate, today)) buckets.daily.done += 1;
      if (freq === "weekly" && latestDate && withinLastDays(latestDate, 7)) buckets.weekly.done += 1;
      if (freq === "monthly" && latestDate && sameMonth(latestDate, today)) buckets.monthly.done += 1;
    });

    let totalDue = 0;
    let totalDone = 0;
    let label = "";

    if (overviewMode === "DAILY") {
      totalDue = buckets.daily.total;
      totalDone = buckets.daily.done;
      label = totalDue ? `Daily ${totalDone}/${totalDue}` : "No daily due";
    } else if (overviewMode === "WEEKLY") {
      totalDue = buckets.weekly.total;
      totalDone = buckets.weekly.done;
      label = totalDue ? `Weekly ${totalDone}/${totalDue}` : "No weekly due";
    } else if (overviewMode === "MONTHLY") {
      totalDue = buckets.monthly.total;
      totalDone = buckets.monthly.done;
      label = totalDue ? `Monthly ${totalDone}/${totalDue}` : "No monthly due";
    } else {
      totalDue = buckets.daily.total + buckets.weekly.total + buckets.monthly.total;
      totalDone = buckets.daily.done + buckets.weekly.done + buckets.monthly.done;
      label = totalDue ? `${totalDone}/${totalDue} done` : "All clear";
    }

    const percent = totalDue ? (totalDone / totalDue) * 100 : 100;
    return { buckets, totalDue, totalDone, percent, label };
  }, [checklists, completed, overviewMode]);

  const todayCompliance = useMemo(() => {
    let clPass = 0;
    let clTotal = 0;

    completed.forEach((run) => {
      const t = run.completedAt || run.createdAt;
      if (!isToday(t)) return;

      const qs = Array.isArray(run.questions) ? run.questions : [];
      qs.forEach((q) => {
        const hasAnswer = (q?.answer ?? "") !== "";
        if (!hasAnswer) return;

        const isPass = !(q?.corrective || "").toString().trim();
        if (isPass) clPass += 1;
        clTotal += 1;
      });
    });

    const todayStr = new Date().toLocaleDateString();
    let tPass = 0;
    let tTotal = 0;

    equipment
      .filter((eq) => eq.type === "Fridge" || eq.type === "Freezer")
      .forEach((eq) => {
        const recs = Array.isArray(eq.records) ? eq.records : [];
        recs.forEach((r) => {
          if (r?.date !== todayStr) return;

          const temp = Number(r?.temp);
          if (Number.isNaN(temp)) return;

          const pass =
            eq.type === "Fridge"
              ? temp >= TEMP_LIMITS.Fridge.min && temp <= TEMP_LIMITS.Fridge.max
              : temp <= TEMP_LIMITS.Freezer.max;

          if (pass) tPass += 1;
          tTotal += 1;
        });
      });

    let cPass = 0;
    let cTotal = 0;

    cleanLogs.forEach((log) => {
      if (!isToday(log.createdAt)) return;
      cPass += 1;
      cTotal += 1;
    });

    const totalPass = clPass + tPass + cPass;
    const total = clTotal + tTotal + cTotal;
    const pct = total ? Math.round((totalPass / total) * 100) : 100;

    return {
      totalPass,
      total,
      pct,
      cl: { pass: clPass, total: clTotal },
      t: { pass: tPass, total: tTotal },
      c: { pass: cPass, total: cTotal },
    };
  }, [completed, equipment, cleanLogs]);

  const stockAlerts = useMemo(() => {
    return stockBatches.filter((batch) => {
      const status = (batch.status || "active").toString().toLowerCase();
      const remaining = Number(batch.quantityRemaining ?? batch.quantity ?? 0);
      return status === "active" && remaining > 0 && (!batch.useByDate || batch.needsUseByReview === true);
    });
  }, [stockBatches]);

  const { buckets, totalDue, totalDone, percent, label } = overview;

  const actionWidgets = useMemo(() => {
    const failedTempsToday = todayCompliance.t.total - todayCompliance.t.pass;
    const overdueDailyChecks = buckets.daily.total - buckets.daily.done;
    const incompleteCleaning = todayCompliance.c.total - todayCompliance.c.pass;
    const stockUseByAlerts = stockAlerts.length;

    return [
      {
        label: "Overdue daily checks",
        value: overdueDailyChecks,
        tone: overdueDailyChecks > 0 ? "bad" : "good",
        onClick: () => setActiveSection("checklists"),
      },
      {
        label: "Failed temps today",
        value: failedTempsToday,
        tone: failedTempsToday > 0 ? "bad" : "good",
        onClick: () => setActiveSection("temp"),
      },
      {
        label: "Cleaning incomplete",
        value: incompleteCleaning,
        tone: incompleteCleaning > 0 ? "warn" : "good",
        onClick: () => setActiveSection("cleaning"),
      },
      {
        label: "Stock use-by alerts",
        value: stockUseByAlerts,
        tone: stockUseByAlerts > 0 ? "warn" : "good",
        onClick: () => setActiveSection("stock"),
      },
    ];
  }, [todayCompliance, buckets, stockAlerts]);

  const resetSite = () => {
    setSelectedSite(null);
    setActiveSection(null);
    setEditDashboard(false);
    setDashboardConfig(null);
    setChecklists([]);
    setLegacyChecklists([]);
    setTemplates([]);
    setSiteTemplates([]);
    setCompleted([]);
    setEquipment([]);
    setCleanLogs([]);
    setStockBatches([]);
  };

  const sections = [
    { label: "Dashboard", key: "dashboard", icon: <FaHome size={17} /> },
    { label: "Checklists", key: "checklists", icon: <FaClipboardCheck size={17} />, color: "#15985f" },
    { label: "Temp Checks", key: "temp", icon: <FaThermometerHalf size={17} />, color: "#dc2626" },
    { label: "Fridge Log", key: "fridgeLog", icon: <FaThermometerHalf size={17} />, color: "#0284c7" },
    { label: "Waste Log", key: "wasteLog", icon: <FaTrashAlt size={17} />, color: "#111827" },
    { label: "My Rota", key: "myRota", icon: <FaRegCalendarCheck size={17} />, color: "#111827" },
    { label: "How To", key: "howto", icon: <FaUtensils size={17} />, color: "#111827" },
    { label: "Cleaning", key: "cleaning", icon: <FaBroom size={17} />, color: "#15985f" },
    { label: "Cooking & Cooling", key: "cooking", icon: <FaDrumstickBite size={17} />, color: "#f59e0b" },
    { label: "Stock", key: "stock", icon: <FaBoxes size={17} />, color: "#7c3aed" },
    { label: "Reports", key: "reports", icon: <FaChartBar size={17} />, color: "#9333ea" },
    { label: "Dishes", key: "dishes", icon: <FaUtensils size={17} />, color: "#0284c7" },
    { label: "Staff Training", key: "training", icon: <FaUserGraduate size={17} />, color: "#0284c7" },
    ...(isManager ? [{ label: "Staff", key: "staff", icon: <FaUserCheck size={17} />, color: "#111827" }] : []),
    { label: "HACCP Dashboard", key: "haccpDashboard", icon: <FaExclamationTriangle size={17} />, color: "#15985f" },
    { label: "CCPs", key: "ccp", icon: <FaExclamationTriangle size={17} />, color: "#dc2626" },
    { label: "Add Equipment", key: "equipment", icon: <FaTools size={17} />, color: "#111827" },
  ];

  const defaultDashboardSections = useMemo(
    () => [
      ...sections.filter((s) => s.key !== "dashboard"),
      {
        label: "Opening Checklist",
        key: "shortcutOpeningChecklist",
        icon: <FaClipboardCheck size={17} />,
        color: "#16a34a",
        shortcutTo: "checklists",
        helper: "Jump straight to checklists",
      },
      {
        label: "Use-by Issues",
        key: "shortcutUseByIssues",
        icon: <FaExclamationTriangle size={17} />,
        color: "#f59e0b",
        shortcutTo: "stock",
        helper: `${stockAlerts.length} issue${stockAlerts.length === 1 ? "" : "s"}`,
      },
      {
        label: "Failed Temps",
        key: "shortcutFailedTemps",
        icon: <FaThermometerHalf size={17} />,
        color: "#dc2626",
        shortcutTo: "temp",
        helper: `${todayCompliance.t.total - todayCompliance.t.pass} today`,
      },
      {
        label: "Fridge Log Today",
        key: "shortcutFridgeLogToday",
        icon: <FaThermometerHalf size={17} />,
        color: "#0284c7",
        shortcutTo: "fridgeLog",
        helper: "Open fridge records",
      },
      {
        label: "Waste Log Today",
        key: "shortcutWasteToday",
        icon: <FaTrashAlt size={17} />,
        color: "#111827",
        shortcutTo: "wasteLog",
        helper: "Record or review waste",
      },
    ],
    [sections, stockAlerts.length, todayCompliance.t.total, todayCompliance.t.pass]
  );

  const dashboardConfigId = selectedSite
    ? `${selectedSite}_${user?.uid || user?.email || user?.name || "default"}`
    : null;

  const dashboardConfigRef = dashboardConfigId ? doc(db, "dashboardConfigs", dashboardConfigId) : null;

  const dashboardSections = useMemo(() => {
    if (!dashboardConfig) return defaultDashboardSections;

    const map = new Map(defaultDashboardSections.map((s) => [s.key, s]));

    const ordered = (dashboardConfig.order || [])
      .map((key) => map.get(key))
      .filter(Boolean);

    const missing = defaultDashboardSections.filter(
      (s) => !(dashboardConfig.order || []).includes(s.key)
    );

    return [...ordered, ...missing];
  }, [dashboardConfig, defaultDashboardSections]);

  const enabledDashboardKeys = useMemo(() => {
    return dashboardConfig?.enabledKeys || defaultDashboardSections.map((s) => s.key);
  }, [dashboardConfig, defaultDashboardSections]);

  const saveDashboardConfig = async (nextConfig) => {
    if (!dashboardConfigRef) return;

    setDashboardConfig(nextConfig);

    await setDoc(
      dashboardConfigRef,
      {
        ...nextConfig,
        site: selectedSite,
        userId: user?.uid || user?.email || user?.name || "default",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  };

  const toggleWidget = async (key) => {
    const currentEnabled = enabledDashboardKeys;

    const nextEnabled = currentEnabled.includes(key)
      ? currentEnabled.filter((k) => k !== key)
      : [...currentEnabled, key];

    await saveDashboardConfig({
      order: dashboardSections.map((s) => s.key),
      enabledKeys: nextEnabled,
    });
  };

  const handleDashboardDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = dashboardSections.findIndex((s) => s.key === active.id);
    const newIndex = dashboardSections.findIndex((s) => s.key === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const newSections = arrayMove(dashboardSections, oldIndex, newIndex);

    await saveDashboardConfig({
      order: newSections.map((s) => s.key),
      enabledKeys: enabledDashboardKeys,
    });
  };

  const openSection = (sectionKey) => {
    if (sectionKey === "dashboard") return setActiveSection(null);
    setActiveSection(sectionKey);
  };

  const openDashboardWidget = (sec) => {
    if (sec.shortcutTo) return openSection(sec.shortcutTo);
    return openSection(sec.key);
  };

  useEffect(() => {
    if (!selectedSite || !dashboardConfigRef) return;

    let cancelled = false;

    const loadDashboardConfig = async () => {
      const snap = await getDoc(dashboardConfigRef);

      if (cancelled) return;

      if (snap.exists()) {
        setDashboardConfig(snap.data());
      } else {
        const initialConfig = {
          order: defaultDashboardSections.map((s) => s.key),
          enabledKeys: defaultDashboardSections.map((s) => s.key),
        };

        setDashboardConfig(initialConfig);
        await setDoc(
          dashboardConfigRef,
          {
            ...initialConfig,
            site: selectedSite,
            userId: user?.uid || user?.email || user?.name || "default",
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    };

    loadDashboardConfig().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [selectedSite, user?.uid, user?.email, user?.name, defaultDashboardSections]);

  if (selectedSite && activeSection === "equipment") {
    return <EquipmentManager goBack={() => setActiveSection(null)} tempChecks={tempChecks} setTempChecks={setTempChecks} site={selectedSite} user={user} />;
  }

  if (selectedSite && activeSection === "checklists") {
    return <ChecklistSection goBack={() => setActiveSection(null)} site={selectedSite} user={user} />;
  }

  if (selectedSite && activeSection === "temp") {
    const siteTempChecks = tempChecks.filter(
      (e) => selectedSiteKeys.includes(e.site) && (e.type === "Fridge" || e.type === "Freezer")
    );

    return <TempSection goBack={() => setActiveSection(null)} tempChecks={siteTempChecks} setTempChecks={setTempChecks} site={selectedSite} user={user} />;
  }

  if (selectedSite && activeSection === "fridgeLog") {
    return <FridgeLogSection goBack={() => setActiveSection(null)} site={selectedSite} user={user} equipment={equipment} />;
  }

  if (selectedSite && activeSection === "wasteLog") {
    return <WasteLogSection goBack={() => setActiveSection(null)} site={selectedSite} user={user} />;
  }

  if (selectedSite && activeSection === "howto") {
    return <HowToSection site={selectedSite} user={user} goBack={() => setActiveSection(null)} />;
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
    const cookingEquipment = tempChecks.filter((e) => selectedSiteKeys.includes(e.site) && e.type === "Cooking");
    return <CookingSection goBack={() => setActiveSection(null)} cookingEquipment={cookingEquipment} setTempChecks={setTempChecks} site={selectedSite} user={user} />;
  }

  if (selectedSite && activeSection === "stock") {
    return <StockSection goBack={() => setActiveSection(null)} site={selectedSite} user={user} />;
  }

  if (selectedSite && activeSection === "reports") {
    return <Reports goBack={() => setActiveSection(null)} site={selectedSite} user={user} />;
  }

  if (selectedSite && activeSection === "ccp") {
    return <CCPSection goBack={() => setActiveSection(null)} site={selectedSite} user={user} />;
  }

  if (selectedSite && activeSection === "haccpDashboard") {
    return <HaccpDashboard goBack={() => setActiveSection(null)} site={selectedSite} />;
  }

  if (selectedSite && activeSection === "dishes") {
    return <DishesSection goBack={() => setActiveSection(null)} site={selectedSite} user={user} />;
  }

  if (selectedSite && activeSection === "training") {
    return <StaffTrainingSection goBack={() => setActiveSection(null)} site={selectedSite} user={user} />;
  }

  if (selectedSite && activeSection === "myRota") {
    return <MyRota goBack={() => setActiveSection(null)} user={user} />;
  }

  if (selectedSite && activeSection === "staff") {
    return <StaffManager goBack={() => setActiveSection(null)} user={user} />;
  }

  if (!selectedSite) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #073b3a 0%, #0b4d4b 45%, #0f5c59 100%)", padding: 24, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "34px 0" }}>
          <div style={{ textAlign: "center", color: "#fff", marginBottom: 24 }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.6 }}>Safe<span style={{ color: "#4ade80" }}>Stack</span></div>
            <div style={{ marginTop: 6, opacity: 0.84, fontSize: 14 }}>Choose a venue</div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {sites.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSite(s.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(255,255,255,0.96)",
                  border: "1px solid rgba(255,255,255,0.6)",
                  borderRadius: 18,
                  padding: "18px 20px",
                  boxShadow: "0 4px 14px rgba(15,23,42,0.08)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, background: "#ecfdf5", display: "grid", placeItems: "center", color: "#15803d" }}>
                    <FaMapMarkerAlt />
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Open site dashboard</div>
                  </div>
                </div>
                <FaChevronRight color="#94a3b8" />
              </button>
            ))}

            <button
              onClick={() => alert("Setup new venue flow coming soon")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: 18,
                padding: "18px 20px",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 700,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FaPlus /> Set up a new venue
              </span>
              <FaChevronRight />
            </button>
          </div>

          <button
            onClick={onLogout}
            style={{
              marginTop: 22,
              width: "100%",
              padding: "14px 18px",
              borderRadius: 14,
              cursor: "pointer",
              backgroundColor: "#dc2626",
              color: "#fff",
              border: "none",
              fontWeight: 800,
            }}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .safestack-shell {
          display: grid;
          grid-template-columns: 260px 1fr;
          min-height: 100vh;
        }

        .safestack-sidebar {
          background: linear-gradient(180deg, #073b3a 0%, #063230 100%);
          color: #fff;
          padding: 24px 16px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }

        .safestack-main {
          min-width: 0;
          padding: 28px;
        }

        .safestack-card {
          background: rgba(255,255,255,0.97);
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          box-shadow: 0 4px 14px rgba(15,23,42,0.06);
        }

        .nav-button:hover {
          background: rgba(255,255,255,0.14) !important;
        }

        .tile-button:hover,
        .alert-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15,23,42,0.08) !important;
          background: #fff !important;
        }

        @media (max-width: 820px) {
          .safestack-shell {
            grid-template-columns: 1fr;
          }

          .safestack-sidebar {
            display: none;
          }

          .safestack-main {
            padding: 16px;
          }
        }
      `}</style>

      <div className="safestack-shell">
        <aside className="safestack-sidebar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26 }}>
            <div style={{ color: "#4ade80", fontSize: 28 }}>
              <FaShieldAlt />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6 }}>
              SAFE<span style={{ color: "#4ade80" }}>STACK</span>
            </div>
          </div>

          <div className="nav-list" style={{ display: "grid", gap: 7 }}>
            {sections.map((sec) => {
              const active = sec.key === "dashboard" && !activeSection;
              return (
                <button
                  key={sec.key}
                  className="nav-button"
                  onClick={() => openSection(sec.key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    border: "none",
                    borderRadius: 12,
                    padding: "11px 12px",
                    cursor: "pointer",
                    background: active ? "linear-gradient(135deg, #16a34a, #15803d)" : "transparent",
                    color: "#fff",
                    fontWeight: active ? 800 : 600,
                    transition: "all 0.18s ease",
                    textAlign: "left",
                  }}
                >
                  <span style={{ width: 22, display: "grid", placeItems: "center" }}>{sec.icon}</span>
                  <span style={{ fontSize: 14 }}>{sec.label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 28, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 700 }}>VENUE</div>
            <div style={{ marginTop: 5, fontSize: 15, fontWeight: 800 }}>{selectedSiteLabel}</div>
            <div style={{ marginTop: 5, fontSize: 12, opacity: 0.72 }}>
              {user?.name || "Unknown"} · {user?.role || "Staff"}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
            <button
              onClick={resetSite}
              style={{
                border: "none",
                borderRadius: 12,
                padding: "11px 12px",
                background: "#fff",
                color: "#064e3b",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Change venue
            </button>

            <button
              onClick={onLogout}
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 12,
                padding: "11px 12px",
                background: "rgba(220,38,38,0.92)",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>

          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
            <FaShieldAlt color="#4ade80" /> Food Safety. Made Simple.
          </div>
        </aside>

        <main className="safestack-main">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: isMobile ? 30 : 34, color: "#0f172a", fontWeight: 800, letterSpacing: -0.7 }}>
                Dashboard
              </h1>
              <div style={{ marginTop: 5, color: "#334155", fontSize: 15 }}>{selectedSiteLabel}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => setEditDashboard((prev) => !prev)}
                style={{
                  border: "1px solid #e5e7eb",
                  background: editDashboard ? "#15803d" : "#fff",
                  color: editDashboard ? "#fff" : "#0f172a",
                  borderRadius: 999,
                  padding: "9px 14px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {editDashboard ? "Done editing" : "Edit dashboard"}
              </button>

              <FaBell color="#0f172a" />
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 999, padding: "8px 12px" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#15803d", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>
                  {(user?.name || "U").slice(0, 1).toUpperCase()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{user?.name || "User"}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 18, marginBottom: 18 }}>
            <div className="safestack-card" style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "170px 1fr", gap: 20, alignItems: "center" }}>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Donut percent={todayCompliance.pct} label={`Overall today (${todayCompliance.totalPass}/${todayCompliance.total || 0})`} size={136} stroke={12} />
                </div>

                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>Audit Ready</div>
                  <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>
                    {todayCompliance.totalPass}/{todayCompliance.total || 0} pass · Every cleaning record counts as completed
                  </div>

                  <div style={{ height: 1, background: "#e5e7eb", margin: "12px 0 16px" }} />

                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>Checklist Overview</div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {["ALL", "DAILY", "WEEKLY", "MONTHLY"].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setOverviewMode(mode)}
                        style={{
                          padding: "9px 14px",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          background: overviewMode === mode ? "#15985f" : "#fff",
                          color: overviewMode === mode ? "#fff" : "#0f172a",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {mode === "ALL" ? "All" : mode.charAt(0) + mode.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span style={chip("#ecfeff", "#075985")}>Daily: <strong>{buckets.daily.done}/{buckets.daily.total}</strong></span>
                    <span style={chip("#f5f3ff", "#5b21b6")}>Weekly: <strong>{buckets.weekly.done}/{buckets.weekly.total}</strong></span>
                    <span style={chip("#fef3c7", "#92400e")}>Monthly: <strong>{buckets.monthly.done}/{buckets.monthly.total}</strong></span>
                  </div>

                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 14 }}>
                    Scheduled progress: {Math.round(percent)}% ({totalDone}/{totalDue || 0}) · {label}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 18 }}>
              <div className="safestack-card" style={{ padding: 22, display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 58, height: 58, borderRadius: 18, background: "linear-gradient(135deg,#22c55e,#15803d)", color: "#fff", display: "grid", placeItems: "center", fontSize: 28 }}>
                  <FaShieldAlt />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>All good today</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: "#64748b" }}>You’re on track with food safety</div>
                  <div style={{ marginTop: 12, height: 7, borderRadius: 999, background: "#dcfce7", overflow: "hidden" }}>
                    <div style={{ width: `${todayCompliance.pct}%`, height: "100%", background: "#15985f" }} />
                  </div>
                </div>
                <div style={{ color: "#15803d", fontWeight: 800 }}>{todayCompliance.pct}%</div>
              </div>

              <div className="safestack-card" style={{ padding: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>Alerts</div>

                {failedTempAlerts.length === 0 && stockAlerts.length === 0 && buckets.daily.total - buckets.daily.done <= 0 && todayCompliance.c.total - todayCompliance.c.pass <= 0 ? (
                  <div style={{ color: "#64748b", fontSize: 14 }}>No active alerts.</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {failedTempAlerts.slice(0, 3).map((alert) => (
                      <div
                        key={alert.id}
                        style={{
                          border: "1px solid #fee2e2",
                          background: "#fff7f7",
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <FaExclamationTriangle color="#dc2626" style={{ marginTop: 2 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 900, color: "#0f172a" }}>{alert.equipmentName}</div>
                            <div style={{ fontSize: 13, color: "#dc2626", marginTop: 2 }}>
                              {alert.equipmentType} recorded at {alert.temp}°C
                            </div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 5 }}>
                              {alert.corrective}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setActiveSection("temp")}
                          style={{
                            marginTop: 10,
                            width: "100%",
                            border: "none",
                            borderRadius: 10,
                            padding: "9px 10px",
                            background: "#dc2626",
                            color: "#fff",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Open temp checks
                        </button>
                      </div>
                    ))}

                    {stockAlerts.slice(0, 4).map((batch) => {
                      const draftDate = stockUseByDrafts[batch.id] || batch.useByDate || "";

                      return (
                        <div
                          key={batch.id}
                          style={{
                            border: "1px solid #fde68a",
                            background: "#fffbeb",
                            borderRadius: 14,
                            padding: 12,
                          }}
                        >
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <FaExclamationTriangle color="#f59e0b" style={{ marginTop: 2 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                                {batch.stockItemName || batch.itemName || batch.name || "Stock item"}
                              </div>
                              <div style={{ fontSize: 13, color: "#92400e", marginTop: 2 }}>
                                Missing use-by date
                              </div>
                              <div style={{ fontSize: 12, color: "#64748b", marginTop: 5 }}>
                                Remaining: {batch.quantityRemaining ?? batch.quantity ?? "—"} {batch.measurement || ""} · Received: {batch.dateReceived || "—"}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 8, marginTop: 10 }}>
                            <input
                              type="date"
                              value={draftDate}
                              onChange={(e) =>
                                setStockUseByDrafts((prev) => ({
                                  ...prev,
                                  [batch.id]: e.target.value,
                                }))
                              }
                              style={{
                                border: "1px solid #f59e0b",
                                borderRadius: 10,
                                padding: "9px 10px",
                                fontSize: 14,
                                background: "#fff",
                              }}
                            />

                            <button
                              onClick={() => updateStockBatchUseBy(batch.id, draftDate)}
                              style={{
                                border: "none",
                                borderRadius: 10,
                                padding: "9px 12px",
                                background: "#f59e0b",
                                color: "#fff",
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {buckets.daily.total - buckets.daily.done > 0 && (
                      <button
                        onClick={() => setActiveSection("checklists")}
                        style={{
                          border: "1px solid #e5e7eb",
                          background: "#fff",
                          borderRadius: 14,
                          padding: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <FaClipboardCheck color="#15985f" />
                          <div>
                            <div style={{ fontWeight: 900, color: "#0f172a" }}>Overdue daily checks</div>
                            <div style={{ fontSize: 12, color: "#dc2626" }}>{buckets.daily.total - buckets.daily.done} needs attention</div>
                          </div>
                        </div>
                        <FaChevronRight color="#94a3b8" />
                      </button>
                    )}

                    {todayCompliance.c.total - todayCompliance.c.pass > 0 && (
                      <button
                        onClick={() => setActiveSection("cleaning")}
                        style={{
                          border: "1px solid #e5e7eb",
                          background: "#fff",
                          borderRadius: 14,
                          padding: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <FaBroom color="#f59e0b" />
                          <div>
                            <div style={{ fontWeight: 900, color: "#0f172a" }}>Cleaning incomplete</div>
                            <div style={{ fontSize: 12, color: "#dc2626" }}>{todayCompliance.c.total - todayCompliance.c.pass} needs attention</div>
                          </div>
                        </div>
                        <FaChevronRight color="#94a3b8" />
                      </button>
                    )}

                    {(failedTempAlerts.length > 3 || stockAlerts.length > 4) && (
                      <div style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>
                        Showing the first urgent items. Open the full section to review everything.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {editDashboard && (
            <div
              className="safestack-card"
              style={{
                padding: 16,
                marginBottom: 16,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Edit dashboard</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Drag cards using the grip icon. Use the ON/OFF button to hide or show dashboard widgets.
              </div>
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDashboardDragEnd}>
            <SortableContext items={dashboardSections.map((s) => s.key)} strategy={rectSortingStrategy}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
                {dashboardSections
                  .filter((sec) => editDashboard || enabledDashboardKeys.includes(sec.key))
                  .map((sec) => (
                    <SortableDashboardTile
                      key={sec.key}
                      sec={sec}
                      openSection={openDashboardWidget}
                      editMode={editDashboard}
                      enabled={enabledDashboardKeys.includes(sec.key)}
                      toggleWidget={toggleWidget}
                    />
                  ))}
              </div>
            </SortableContext>
          </DndContext>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <button
              onClick={resetSite}
              style={{
                padding: "12px 28px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#0f172a",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SitePage;
