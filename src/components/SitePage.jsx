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
} from "react-icons/fa";

import { db } from "../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

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
  fontWeight: 800,
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
        <div style={{ fontSize: 22, fontWeight: 900, color: "#111" }}>{Math.round(clamped)}%</div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>{label}</div>
      </div>
    </div>
  );
};

const useIsMobile = (breakpoint = 760) => {
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

      const overrideTitle = st.overrides?.title;
      const qOverrides = st.overrides?.questions || {};

      const questions = (tpl.questions || []).map((q) => {
        const base = q;
        const o = qOverrides[base.id];
        return { ...base, enabled: o?.enabled ?? base.enabled ?? true };
      });

      return {
        id: tpl.id,
        site: siteId,
        title: overrideTitle || tpl.title,
        frequency: tpl.frequency || "Ad hoc",
        questions,
        _source: "template",
        _templateId: tpl.id,
      };
    })
    .filter(Boolean);
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
  const isMobile = useIsMobile();

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
        rows.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setLegacyChecklists(rows);
      },
      () => setLegacyChecklists([])
    );

    const unsubDone = onSnapshot(
      collection(db, COLLECTIONS.completedChecklists),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(filterForSelectedSite);
        rows.sort((a, b) => {
          const ta = a.completedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
          const tb = b.completedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setCompleted(rows);
      },
      () => setCompleted([])
    );

    const unsubEquip = onSnapshot(
      collection(db, "equipment"),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(filterForSelectedSite);
        setEquipment(rows);
      },
      () => setEquipment([])
    );

    const unsubClean = onSnapshot(
      collection(db, COLLECTIONS.cleaningLogs),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(filterForSelectedSite);
        setCleanLogs(rows);
      },
      () => setCleanLogs([])
    );

    const unsubStockBatches = onSnapshot(
      collection(db, COLLECTIONS.stockBatches),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(filterForSelectedSite);
        setStockBatches(rows);
      },
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

    if (siteTemplates.length > 0) {
      setChecklists(buildChecklistsFromTemplates(selectedSite, siteTemplates, templates));
    } else {
      setChecklists(legacyChecklists);
    }
  }, [selectedSite, siteTemplates, templates, legacyChecklists]);

  const overview = useMemo(() => {
    const today = new Date();

    const getLatestForChecklist = (cl) => {
      const t = norm(cl.title || "");
      const matches = completed.filter((c) => {
        const cid = c.checklistId || c.checklistRef || c.checklist_id;
        const tid = c.templateId;

        if (cl._source === "template") {
          if (tid && tid === cl.id) return true;
        } else if (cid && cid === cl.id) {
          return true;
        }

        const ct = norm(c.title || c.checklistTitle || "");
        return t && ct && ct === t;
      });

      if (!matches.length) return null;

      matches.sort((a, b) => {
        const ta = a.completedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const tb = b.completedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });

      return matches[0]?.completedAt || matches[0]?.createdAt || null;
    };

    const buckets = {
      daily: { total: 0, done: 0 },
      weekly: { total: 0, done: 0 },
      monthly: { total: 0, done: 0 },
    };

    for (const cl of checklists) {
      const freq = (cl.frequency || "Ad hoc").toString().trim().toLowerCase();
      if (!["daily", "weekly", "monthly"].includes(freq)) continue;

      const latest = getLatestForChecklist(cl);
      const latestDate = latest ? toDate(latest) : null;

      if (freq === "daily") {
        buckets.daily.total += 1;
        if (latestDate && isSameDay(latestDate, today)) buckets.daily.done += 1;
      }

      if (freq === "weekly") {
        buckets.weekly.total += 1;
        if (latestDate && withinLastDays(latestDate, 7)) buckets.weekly.done += 1;
      }

      if (freq === "monthly") {
        buckets.monthly.total += 1;
        if (latestDate && sameMonth(latestDate, today)) buckets.monthly.done += 1;
      }
    }

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
      default:
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

        const corrective = (q?.corrective || "").toString().trim();
        const isPass = corrective.length === 0;
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

          let pass = false;

          if (eq.type === "Fridge") {
            const { min, max } = TEMP_LIMITS.Fridge;
            pass = temp >= min && temp <= max;
          } else {
            const { max } = TEMP_LIMITS.Freezer;
            pass = temp <= max;
          }

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
      cl: { pass: clPass, total: clTotal, pct: clTotal ? Math.round((clPass / clTotal) * 100) : 0 },
      t: { pass: tPass, total: tTotal, pct: tTotal ? Math.round((tPass / tTotal) * 100) : 0 },
      c: { pass: cPass, total: cTotal, pct: cTotal ? Math.round((cPass / cTotal) * 100) : 0 },
    };
  }, [completed, equipment, cleanLogs]);

  const stockAlerts = useMemo(() => {
    return stockBatches.filter((batch) => {
      const status = (batch.status || "active").toString().toLowerCase();
      const remaining = Number(batch.quantityRemaining ?? batch.quantity ?? 0);

      const isActive = status === "active";
      const hasStockRemaining = remaining > 0;
      const missingUseBy = !batch.useByDate;
      const needsReview = batch.needsUseByReview === true;

      return isActive && hasStockRemaining && (missingUseBy || needsReview);
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
    { label: "Checklists", key: "checklists", icon: <FaClipboardCheck size={18} /> },
    { label: "Temp Checks", key: "temp", icon: <FaThermometerHalf size={18} /> },
    { label: "Fridge Log", key: "fridgeLog", icon: <FaThermometerHalf size={18} /> },
    { label: "Waste Log", key: "wasteLog", icon: <FaTrashAlt size={18} /> },
    { label: "My Rota", key: "myRota", icon: <FaRegCalendarCheck size={18} /> },
    { label: "How To", key: "howto", icon: <FaUtensils size={18} /> },
    { label: "Cleaning", key: "cleaning", icon: <FaBroom size={18} /> },
    { label: "Cooking & Cooling", key: "cooking", icon: <FaDrumstickBite size={18} /> },
    { label: "Stock", key: "stock", icon: <FaBoxes size={18} /> },
    { label: "Reports", key: "reports", icon: <FaChartBar size={18} /> },
    { label: "Dishes", key: "dishes", icon: <FaUtensils size={18} /> },
    { label: "Staff Training", key: "training", icon: <FaUserGraduate size={18} /> },
    ...(isManager ? [{ label: "Staff", key: "staff", icon: <FaUserCheck size={18} /> }] : []),
    { label: "HACCP Dashboard", key: "haccpDashboard", icon: <FaExclamationTriangle size={18} /> },
    { label: "CCPs", key: "ccp", icon: <FaExclamationTriangle size={18} /> },
    { label: "Add Equipment", key: "equipment", icon: <FaTools size={18} /> },
  ];

  const openSection = (sectionKey) => setActiveSection(sectionKey);

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
      <div style={{ minHeight: "100vh", background: "#0f4f4c", padding: 24, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "34px 0" }}>
          <div style={{ textAlign: "center", color: "#fff", marginBottom: 24 }}>
            <div style={{ fontSize: 32, fontWeight: 950 }}>SafeStack</div>
            <div style={{ marginTop: 6, opacity: 0.85, fontSize: 14 }}>Choose a venue</div>
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
                  background: "#fff",
                  border: "none",
                  borderRadius: 20,
                  padding: "18px 20px",
                  boxShadow: "0 14px 35px rgba(0,0,0,0.18)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      background: "#ecfeff",
                      display: "grid",
                      placeItems: "center",
                      color: "#0f766e",
                    }}
                  >
                    <FaMapMarkerAlt />
                  </span>
                  <div>
                    <div style={{ fontWeight: 900, color: "#111827" }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Open site dashboard</div>
                  </div>
                </div>
                <FaChevronRight color="#9ca3af" />
              </button>
            ))}

            <button
              onClick={() => alert("Setup new venue flow coming soon")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.24)",
                borderRadius: 20,
                padding: "18px 20px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 900 }}>
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
              borderRadius: 16,
              cursor: "pointer",
              backgroundColor: "#dc2626",
              color: "#fff",
              border: "none",
              fontWeight: 900,
            }}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f4f4c", fontFamily: "'Inter', sans-serif", padding: isMobile ? 14 : 24 }}>
      <style>{`
        .safestack-shell {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 18px;
        }

        .safestack-sidebar {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 28px;
          padding: 18px;
          color: #fff;
          min-height: calc(100vh - 48px);
          position: sticky;
          top: 24px;
        }

        .safestack-main {
          min-width: 0;
        }

        .safestack-card {
          background: #fff;
          border-radius: 28px;
          box-shadow: 0 18px 45px rgba(0,0,0,0.14);
        }

        .nav-button:hover,
        .tile-button:hover,
        .alert-button:hover {
          transform: translateY(-2px);
        }

        @media (max-width: 760px) {
          .safestack-shell {
            grid-template-columns: 1fr;
          }

          .safestack-sidebar {
            position: relative;
            top: 0;
            min-height: auto;
          }

          .nav-list {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="safestack-shell">
        <aside className="safestack-sidebar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 16,
                background: "#fff",
                color: "#0f4f4c",
                display: "grid",
                placeItems: "center",
                fontWeight: 950,
                fontSize: 20,
              }}
            >
              SS
            </div>
            <div>
              <div style={{ fontWeight: 950, fontSize: 20 }}>SafeStack</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Food safety dashboard</div>
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 20, background: "rgba(255,255,255,0.12)", marginBottom: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>VENUE</div>
            <div style={{ fontSize: 18, fontWeight: 950, marginTop: 4 }}>{selectedSiteLabel}</div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
              {user?.name || "Unknown"} · {user?.role || "Staff"}
            </div>
          </div>

          <div className="nav-list" style={{ display: "grid", gap: 8 }}>
            {sections.map((sec) => (
              <button
                key={sec.key}
                className="nav-button"
                onClick={() => openSection(sec.key)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "none",
                  borderRadius: 16,
                  padding: "11px 12px",
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.10)",
                  color: "#fff",
                  fontWeight: 850,
                  transition: "all 0.18s ease",
                  textAlign: "left",
                }}
              >
                <span style={{ width: 24, display: "grid", placeItems: "center" }}>{sec.icon}</span>
                <span style={{ fontSize: 13 }}>{sec.label}</span>
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
            <button
              onClick={resetSite}
              style={{
                border: "none",
                borderRadius: 16,
                padding: "12px 14px",
                background: "#fff",
                color: "#0f4f4c",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Change venue
            </button>

            <button
              onClick={onLogout}
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 16,
                padding: "12px 14px",
                background: "rgba(220,38,38,0.9)",
                color: "#fff",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="safestack-main">
          <div className="safestack-card" style={{ padding: isMobile ? 18 : 26, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
              <div>
                <div style={{ ...chip("#ecfeff", "#0f766e"), marginBottom: 10 }}>Live site overview</div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 28 : 38, color: "#111827", fontWeight: 950 }}>
                  {selectedSiteLabel}
                </h1>
                <div style={{ marginTop: 8, color: "#6b7280", fontSize: 14 }}>
                  Daily checks, temperatures, cleaning and stock alerts in one place.
                </div>
              </div>

              <Donut
                percent={todayCompliance.pct}
                label={`Today ${todayCompliance.total ? `${todayCompliance.totalPass}/${todayCompliance.total}` : "0/0"}`}
                size={isMobile ? 112 : 132}
                stroke={12}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 14, marginBottom: 18 }}>
            {actionWidgets.map((w) => {
              const bg = w.tone === "bad" ? "#fee2e2" : w.tone === "warn" ? "#fef3c7" : "#dcfce7";
              const fg = w.tone === "bad" ? "#991b1b" : w.tone === "warn" ? "#92400e" : "#166534";

              return (
                <button
                  key={w.label}
                  className="alert-button"
                  onClick={w.onClick}
                  style={{
                    background: bg,
                    color: fg,
                    border: "none",
                    borderRadius: 24,
                    padding: 18,
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                    transition: "all 0.18s ease",
                  }}
                >
                  <div style={{ fontSize: 34, fontWeight: 950 }}>{w.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>{w.label}</div>
                </button>
              );
            })}
          </div>

          <div className="safestack-card" style={{ padding: isMobile ? 18 : 24, marginBottom: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "180px 1fr", gap: 20, alignItems: "center" }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Donut
                  percent={percent}
                  label={label}
                  size={isMobile ? 120 : 148}
                  stroke={12}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 950, color: "#111827" }}>Checklist progress</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                      Scheduled progress: {Math.round(percent)}% ({totalDone}/{totalDue || 0})
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["ALL", "DAILY", "WEEKLY", "MONTHLY"].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setOverviewMode(mode)}
                        style={{
                          padding: "9px 12px",
                          borderRadius: 14,
                          border: "1px solid #e5e7eb",
                          background: overviewMode === mode ? "#2563eb" : "#fff",
                          color: overviewMode === mode ? "#fff" : "#111827",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {mode === "ALL" ? "All" : mode.charAt(0) + mode.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                  <span style={chip("#ecfeff", "#075985")}>Daily: <strong>{buckets.daily.done}/{buckets.daily.total}</strong></span>
                  <span style={chip("#f5f3ff", "#5b21b6")}>Weekly: <strong>{buckets.weekly.done}/{buckets.weekly.total}</strong></span>
                  <span style={chip("#fef3c7", "#92400e")}>Monthly: <strong>{buckets.monthly.done}/{buckets.monthly.total}</strong></span>
                  {totalDue === 0 && <span style={chip("#e5e7eb", "#111827")}>No scheduled checklists</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="safestack-card" style={{ padding: isMobile ? 18 : 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 950, color: "#111827" }}>Quick actions</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Open a section from the main dashboard.</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
              {sections.map((sec) => (
                <button
                  key={sec.key}
                  className="tile-button"
                  onClick={() => openSection(sec.key)}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #eef2f7",
                    borderRadius: 22,
                    padding: "20px 16px",
                    minHeight: 112,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    color: "#111827",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 16,
                      background: "#fff",
                      display: "grid",
                      placeItems: "center",
                      marginBottom: 10,
                      boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
                    }}
                  >
                    {sec.icon}
                  </div>
                  <div style={{ fontWeight: 950, fontSize: 14, textAlign: "center" }}>{sec.label}</div>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SitePage;