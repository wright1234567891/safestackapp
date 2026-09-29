import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  FaBookOpen,
  FaCalendarCheck,
  FaCheckCircle,
  FaClipboardCheck,
  FaClock,
  FaExclamationTriangle,
  FaEye,
  FaHistory,
  FaSave,
  FaSearch,
  FaThermometerHalf,
  FaTimesCircle,
  FaUtensils,
} from "react-icons/fa";
import {
  evidenceWindowMs,
  getCompletion,
  isReviewDue,
  normaliseSafeMethod,
  toDateValue,
} from "./sfbbSafeMethods";

const styles = {
  wrap: {
    maxWidth: 1160,
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "'Inter', sans-serif",
    color: "#111827",
  },
  title: { fontSize: 28, fontWeight: 800, marginBottom: 22, textAlign: "center" },
  card: {
    background: "#fff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
    marginBottom: 18,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 800,
    fontSize: 16,
    marginBottom: 14,
  },
  row: { display: "flex", gap: 10, flexWrap: "wrap" },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    fontSize: 14,
    background: "#fff",
    boxSizing: "border-box",
  },
  area: {
    width: "100%",
    minHeight: 78,
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    fontSize: 14,
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
  },
  label: { display: "block", fontWeight: 700, fontSize: 13, marginBottom: 6 },
  help: { fontSize: 12, color: "#6b7280", lineHeight: 1.4, marginTop: 4 },
  tableCell: { padding: "11px 12px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
};

const button = (background = "#f3f4f6", color = "#111827") => ({
  padding: "9px 13px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  cursor: "pointer",
  background,
  color,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
});

const pill = (background = "#eef2ff", color = "#4338ca") => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 9px",
  borderRadius: 999,
  background,
  color,
  fontSize: 12,
  fontWeight: 800,
});

const Field = ({ label, help, children, width = 260, grow = 1 }) => (
  <label style={{ display: "block", flex: `${grow} 1 ${width}px`, minWidth: 210 }}>
    <span style={styles.label}>{label}</span>
    {children}
    {help ? <div style={styles.help}>{help}</div> : null}
  </label>
);

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const getDishStockIds = (dish) => asArray(dish.ingredients)
  .map((ingredient) => ingredient.stockItemId ?? ingredient.stockId)
  .filter(Boolean);

const toNum = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^\-\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const evalAgainstLimits = (ccp, reading) => {
  const value = toNum(reading);
  if (value === null) return { ok: null, reason: "No numeric reading" };
  const min = toNum(ccp.limitMin);
  const max = toNum(ccp.limitMax);
  if (min !== null && value < min) return { ok: false, reason: `${value}°C is below ${min}°C` };
  if (max !== null && value > max) return { ok: false, reason: `${value}°C is above ${max}°C` };
  if (min !== null || max !== null) return { ok: true, reason: `${value}°C meets the numeric limit` };
  return { ok: null, reason: "No numeric limit set" };
};

const dateFromRecord = (record) => {
  if (!record) return null;
  const direct = toDateValue(record.checkedAt || record.createdAt || record.timestamp);
  if (direct) return direct;
  if (record.date) {
    const parsed = new Date(`${record.date}${record.time ? ` ${record.time}` : ""}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const latestRecord = (equipment) => {
  const records = asArray(equipment?.records);
  if (!records.length) return null;
  return [...records].sort((left, right) =>
    (dateFromRecord(right)?.getTime() || 0) - (dateFromRecord(left)?.getTime() || 0)
  )[0];
};

const formatDate = (value, includeTime = true) => {
  const date = toDateValue(value);
  if (!date) return "-";
  return includeTime ? date.toLocaleString() : date.toLocaleDateString();
};

const localDateKey = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultLocalDateTime = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

const STATUS = {
  READY: { label: "Ready", group: "OK", background: "#ecfdf5", color: "#166534", icon: FaCheckCircle },
  DRAFT: { label: "Draft", group: "ACTION", background: "#fff7ed", color: "#9a3412", icon: FaExclamationTriangle },
  ACTION: { label: "Action needed", group: "ACTION", background: "#fef2f2", color: "#991b1b", icon: FaExclamationTriangle },
  FAILED: { label: "Failed check", group: "FAIL", background: "#fef2f2", color: "#991b1b", icon: FaTimesCircle },
  REVIEW_DUE: { label: "Review due", group: "DUE", background: "#fffbeb", color: "#92400e", icon: FaClock },
  EVIDENCE_DUE: { label: "Evidence due", group: "DUE", background: "#fffbeb", color: "#92400e", icon: FaClock },
  NOT_RELEVANT: { label: "Not relevant", group: "NA", background: "#f3f4f6", color: "#4b5563", icon: FaCheckCircle },
};

const statusBadge = (status) => {
  const Icon = status.icon;
  return <span style={pill(status.background, status.color)}><Icon /> {status.label}</span>;
};

const REVIEW_QUESTIONS = [
  ["methodsReviewed", "Safe methods reviewed"],
  ["allergensUpdated", "Allergen information reflects menu/ingredient changes"],
  ["equipmentChangesReviewed", "Equipment/process changes reviewed"],
  ["suppliersUpdated", "New supplier contacts recorded"],
  ["cleaningScheduleReviewed", "Cleaning schedule reviewed"],
  ["newStaffTrained", "New staff trained"],
  ["refresherTrainingReviewed", "Refresher training needs reviewed"],
  ["openingClosingReviewed", "Opening/closing checks remain suitable"],
  ["complaintsInvestigated", "Food complaints investigated"],
  ["probesCalibrated", "Probe calibration recorded in the last 4 weeks"],
  ["extraChecksComplete", "Weekly extra checks completed"],
  ["proveItComplete", "Prove-it checks completed and recorded"],
];

const emptyEvidence = (user) => ({
  recordType: "SAFE_METHOD",
  ccpId: "",
  result: "PASS",
  checkedAtLocal: defaultLocalDateTime(),
  observedValue: "",
  unit: "°C",
  notes: "",
  correctiveActionTaken: "",
  preventionActionTaken: "",
  completedBy: user?.displayName || user?.email || "",
  openingChecksCompleted: false,
  closingChecksCompleted: false,
  safeMethodsFollowed: "YES",
  reviewChecklist: Object.fromEntries(REVIEW_QUESTIONS.map(([key]) => [key, ""])),
});

const HaccpDashboard = ({ site, goBack, user }) => {
  const [ccps, setCCPs] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [stock, setStock] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [checks, setChecks] = useState([]);
  const [viewMode, setViewMode] = useState("METHODS");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [entry, setEntry] = useState(() => emptyEvidence(user));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!site) return undefined;
    const listeners = [
      ["haccpPoints", setCCPs],
      ["equipment", setEquipment],
      ["stockItems", setStock],
      ["dishes", setDishes],
      ["haccpChecks", setChecks],
    ].map(([collectionName, setter]) =>
      onSnapshot(
        query(collection(db, collectionName), where("site", "==", site)),
        (snapshot) => setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        (snapshotError) => setError(snapshotError.message)
      )
    );
    return () => listeners.forEach((unsubscribe) => unsubscribe());
  }, [site]);

  const checksNewestFirst = useMemo(() => [...checks].sort((left, right) =>
    (dateFromRecord(right)?.getTime() || 0) - (dateFromRecord(left)?.getTime() || 0)
  ), [checks]);

  const rows = useMemo(() => {
    const equipmentById = Object.fromEntries(equipment.map((item) => [item.id, item]));
    const stockById = Object.fromEntries(stock.map((item) => [item.id, item]));
    const dishById = Object.fromEntries(dishes.map((item) => [item.id, item]));

    return ccps.map((rawMethod) => {
      const method = normaliseSafeMethod(rawMethod);
      const completion = getCompletion(method);
      const methodChecks = checksNewestFirst.filter((check) => check.ccpId === rawMethod.id);
      const latestCheck = methodChecks[0] || null;
      const linkedEquipment = method.equipmentIds.map((id) => equipmentById[id]).filter(Boolean);
      const equipmentEvidence = linkedEquipment.map((item) => ({
        equipment: item,
        record: latestRecord(item),
      }));
      const failedEquipment = equipmentEvidence.find(({ record }) => evalAgainstLimits(method, record?.temp).ok === false);
      const latestEquipmentDate = equipmentEvidence.reduce((latest, item) => {
        const date = dateFromRecord(item.record);
        return date && (!latest || date > latest) ? date : latest;
      }, null);
      const latestCheckDate = dateFromRecord(latestCheck);
      const latestEvidenceDate = [latestEquipmentDate, latestCheckDate]
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || null;
      const negativeSafetyPoint = method.safetyChecks.find((item) => item.answer === "NO");

      let status = STATUS.READY;
      let statusReason = "Method is complete, in review and has current evidence.";
      if (!method.appliesToBusiness) {
        status = STATUS.NOT_RELEVANT;
        statusReason = "Recorded as not relevant to this site.";
      } else if (latestCheck?.result === "FAIL") {
        status = STATUS.FAILED;
        statusReason = latestCheck.notes || "The latest recorded check failed.";
      } else if (failedEquipment) {
        status = STATUS.FAILED;
        statusReason = evalAgainstLimits(method, failedEquipment.record?.temp).reason;
      } else if (negativeSafetyPoint) {
        status = STATUS.ACTION;
        statusReason = negativeSafetyPoint.question || "A safety-point answer is No.";
      } else if (completion.percent < 100) {
        status = STATUS.DRAFT;
        statusReason = `${completion.missing.length} required item${completion.missing.length === 1 ? "" : "s"} missing.`;
      } else if (isReviewDue(method)) {
        status = STATUS.REVIEW_DUE;
        statusReason = method.reviewDueDate ? `Review was due ${method.reviewDueDate}.` : "No review date is set.";
      } else {
        const windowMs = evidenceWindowMs(method.monitoringFrequency);
        const evidenceTooOld = windowMs && latestEvidenceDate && Date.now() - latestEvidenceDate.getTime() > windowMs;
        const eventFrequency = ["Per batch", "Per delivery", "Per service"].includes(method.monitoringFrequency);
        if ((!latestEvidenceDate && method.monitoringFrequency !== "When changed") || evidenceTooOld || (eventFrequency && !latestEvidenceDate)) {
          status = STATUS.EVIDENCE_DUE;
          statusReason = latestEvidenceDate ? "The latest evidence is older than the monitoring frequency." : "No monitoring evidence has been recorded.";
        }
      }

      return {
        id: rawMethod.id,
        method,
        completion,
        latestCheck,
        latestEvidenceDate,
        equipmentEvidence,
        status,
        statusReason,
        stockNames: method.stockItemIds.map((id) => stockById[id]?.name).filter(Boolean),
        dishNames: method.dishIds.map((id) => dishById[id]?.name).filter(Boolean),
      };
    }).sort((left, right) => `${left.method.category}-${left.method.name}`.localeCompare(`${right.method.category}-${right.method.name}`));
  }, [ccps, equipment, stock, dishes, checksNewestFirst]);

  const filteredRows = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "ALL" || row.status.group === statusFilter;
      const bucket = [
        row.method.name,
        row.method.category,
        row.method.step,
        row.method.businessProcedure,
        row.method.hazardTypes.join(" "),
        row.stockNames.join(" "),
        row.dishNames.join(" "),
      ].join(" ").toLowerCase();
      return matchesStatus && bucket.includes(search);
    });
  }, [rows, searchText, statusFilter]);

  const dishRows = useMemo(() => dishes.map((dish) => {
    const ingredientIds = new Set(getDishStockIds(dish));
    const linked = rows.filter((row) =>
      row.method.dishIds.includes(dish.id) || row.method.stockItemIds.some((id) => ingredientIds.has(id))
    );
    const hasFail = linked.some((row) => row.status.group === "FAIL");
    const hasAction = linked.some((row) => ["ACTION", "DUE"].includes(row.status.group));
    return {
      id: dish.id,
      name: dish.name || "Unnamed dish",
      description: dish.description || "",
      linked,
      status: hasFail ? STATUS.FAILED : hasAction ? STATUS.ACTION : STATUS.READY,
    };
  }).filter((dish) => {
    const search = searchText.trim().toLowerCase();
    return [dish.name, dish.description, ...dish.linked.map((row) => row.method.name)].join(" ").toLowerCase().includes(search);
  }), [dishes, rows, searchText]);

  const latestDaily = checksNewestFirst.find((item) => item.recordType === "DAILY_DIARY");
  const todayDiary = latestDaily && localDateKey(dateFromRecord(latestDaily)) === localDateKey(new Date()) ? latestDaily : null;
  const latestReview = checksNewestFirst.find((item) => item.recordType === "FOUR_WEEKLY_REVIEW");
  const reviewAgeMs = latestReview ? Date.now() - (dateFromRecord(latestReview)?.getTime() || 0) : Infinity;
  const fourWeeklyReviewDue = reviewAgeMs > 31 * 24 * 60 * 60 * 1000;

  const saveEvidence = async () => {
    setError("");
    setMessage("");
    if (!entry.completedBy.trim()) {
      setError("Enter the name of the person completing the record.");
      return;
    }
    if (["SAFE_METHOD", "EXTRA_CHECK"].includes(entry.recordType) && !entry.ccpId) {
      setError("Choose the safe method this evidence belongs to.");
      return;
    }

    const selectedMethod = ccps.find((item) => item.id === entry.ccpId);
    let result = entry.result;
    if (entry.recordType === "SAFE_METHOD" && selectedMethod && entry.observedValue.trim()) {
      const assessed = evalAgainstLimits(normaliseSafeMethod(selectedMethod), entry.observedValue);
      if (assessed.ok === false) result = "FAIL";
    }
    if (entry.recordType === "DAILY_DIARY") {
      result = entry.openingChecksCompleted && entry.closingChecksCompleted && entry.safeMethodsFollowed === "YES" ? "PASS" : "FAIL";
    }
    if (entry.recordType === "FOUR_WEEKLY_REVIEW") {
      const answers = Object.values(entry.reviewChecklist);
      if (answers.some((answer) => !answer)) {
        setError("Answer every 4-weekly review question with Yes, No or N/A.");
        return;
      }
      result = answers.includes("NO") ? "FAIL" : "PASS";
    }
    if (result === "FAIL" && !entry.correctiveActionTaken.trim()) {
      setError("Record the immediate corrective action for a failed entry.");
      return;
    }

    const checkedAt = new Date(entry.checkedAtLocal);
    if (Number.isNaN(checkedAt.getTime())) {
      setError("Enter a valid date and time.");
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "haccpChecks"), {
        site,
        recordType: entry.recordType,
        ccpId: entry.ccpId || null,
        methodName: selectedMethod?.name || null,
        result,
        checkedAt: Timestamp.fromDate(checkedAt),
        observedValue: entry.observedValue.trim(),
        unit: entry.unit.trim(),
        notes: entry.notes.trim(),
        correctiveActionTaken: entry.correctiveActionTaken.trim(),
        preventionActionTaken: entry.preventionActionTaken.trim(),
        completedBy: entry.completedBy.trim(),
        openingChecksCompleted: entry.recordType === "DAILY_DIARY" ? entry.openingChecksCompleted : null,
        closingChecksCompleted: entry.recordType === "DAILY_DIARY" ? entry.closingChecksCompleted : null,
        safeMethodsFollowed: entry.recordType === "DAILY_DIARY" ? entry.safeMethodsFollowed : null,
        reviewChecklist: entry.recordType === "FOUR_WEEKLY_REVIEW" ? entry.reviewChecklist : null,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      });
      setEntry(emptyEvidence(user));
      setMessage("Evidence saved to the HACCP audit log.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    total: rows.length,
    ready: rows.filter((row) => row.status.group === "OK").length,
    action: rows.filter((row) => row.status.group === "ACTION").length,
    due: rows.filter((row) => row.status.group === "DUE").length,
    failed: rows.filter((row) => row.status.group === "FAIL").length,
  };

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>HACCP dashboard - <span style={{ color: "#2563eb" }}>{site}</span></h2>

      <div style={styles.card}>
        <div style={styles.header}><FaClipboardCheck color="#0ea5e9" /> Compliance overview</div>
        <div style={styles.row}>
          <span style={pill()}>Methods: {counts.total}</span>
          <span style={pill("#ecfdf5", "#166534")}><FaCheckCircle /> Ready: {counts.ready}</span>
          <span style={pill("#fff7ed", "#9a3412")}><FaExclamationTriangle /> Draft/action: {counts.action}</span>
          <span style={pill("#fffbeb", "#92400e")}><FaClock /> Due: {counts.due}</span>
          <span style={pill("#fef2f2", "#991b1b")}><FaTimesCircle /> Failed: {counts.failed}</span>
          <span style={pill(todayDiary?.result === "PASS" ? "#ecfdf5" : "#fffbeb", todayDiary?.result === "PASS" ? "#166534" : "#92400e")}>
            <FaCalendarCheck /> Today's diary: {todayDiary ? todayDiary.result.toLowerCase() : "due"}
          </span>
          <span style={pill(fourWeeklyReviewDue ? "#fffbeb" : "#ecfdf5", fourWeeklyReviewDue ? "#92400e" : "#166534")}>
            <FaHistory /> 4-weekly review: {fourWeeklyReviewDue ? "due" : formatDate(latestReview?.checkedAt, false)}
          </span>
        </div>
      </div>

      {message ? <div style={{ ...styles.card, background: "#ecfdf5", color: "#166534" }}><FaCheckCircle /> {message}</div> : null}
      {error ? <div style={{ ...styles.card, background: "#fef2f2", color: "#991b1b" }}><FaExclamationTriangle /> {error}</div> : null}

      <div style={styles.card}>
        <div style={styles.header}><FaSave color="#16a34a" /> Record evidence / diary entry</div>
        <div style={styles.row}>
          <Field label="Record type">
            <select style={styles.input} value={entry.recordType} onChange={(event) => setEntry({ ...entry, recordType: event.target.value })}>
              <option value="SAFE_METHOD">Monitoring / prove-it check</option>
              <option value="DAILY_DIARY">Daily diary sign-off</option>
              <option value="EXTRA_CHECK">Extra check</option>
              <option value="FOUR_WEEKLY_REVIEW">4-weekly review</option>
            </select>
          </Field>
          <Field label="Completed by">
            <input style={styles.input} value={entry.completedBy} onChange={(event) => setEntry({ ...entry, completedBy: event.target.value })} />
          </Field>
          <Field label="Date and time">
            <input type="datetime-local" style={styles.input} value={entry.checkedAtLocal} onChange={(event) => setEntry({ ...entry, checkedAtLocal: event.target.value })} />
          </Field>
        </div>

        {["SAFE_METHOD", "EXTRA_CHECK"].includes(entry.recordType) ? (
          <>
            <div style={{ ...styles.row, marginTop: 12 }}>
              <Field label="Safe method / CCP" width={360} grow={2}>
                <select style={styles.input} value={entry.ccpId} onChange={(event) => setEntry({ ...entry, ccpId: event.target.value })}>
                  <option value="">Choose a method</option>
                  {rows.filter((row) => row.method.appliesToBusiness).map((row) => (
                    <option key={row.id} value={row.id}>{row.method.category} - {row.method.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Result">
                <select style={styles.input} value={entry.result} onChange={(event) => setEntry({ ...entry, result: event.target.value })}>
                  <option value="PASS">Pass</option>
                  <option value="FAIL">Fail</option>
                </select>
              </Field>
              <Field label="Observed value">
                <input style={styles.input} value={entry.observedValue} onChange={(event) => setEntry({ ...entry, observedValue: event.target.value })} placeholder="e.g. 78.2" />
              </Field>
              <Field label="Unit">
                <input style={styles.input} value={entry.unit} onChange={(event) => setEntry({ ...entry, unit: event.target.value })} placeholder="°C, minutes, visual..." />
              </Field>
            </div>
          </>
        ) : null}

        {entry.recordType === "DAILY_DIARY" ? (
          <div style={{ ...styles.row, marginTop: 14, alignItems: "center" }}>
            <label style={pill("#f8fafc", "#334155")}><input type="checkbox" checked={entry.openingChecksCompleted} onChange={(event) => setEntry({ ...entry, openingChecksCompleted: event.target.checked })} /> Opening checks complete</label>
            <label style={pill("#f8fafc", "#334155")}><input type="checkbox" checked={entry.closingChecksCompleted} onChange={(event) => setEntry({ ...entry, closingChecksCompleted: event.target.checked })} /> Closing checks complete</label>
            <Field label="Were safe methods followed and supervised?" width={310} grow={2}>
              <select style={styles.input} value={entry.safeMethodsFollowed} onChange={(event) => setEntry({ ...entry, safeMethodsFollowed: event.target.value })}>
                <option value="YES">Yes</option>
                <option value="NO">No - record action below</option>
              </select>
            </Field>
          </div>
        ) : null}

        {entry.recordType === "FOUR_WEEKLY_REVIEW" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10, marginTop: 14 }}>
            {REVIEW_QUESTIONS.map(([key, label]) => (
              <label key={key} style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8, alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 600 }}>
                <span>{label}</span>
                <select
                  style={{ ...styles.input, padding: "7px 8px" }}
                  value={entry.reviewChecklist[key]}
                  onChange={(event) => setEntry({ ...entry, reviewChecklist: { ...entry.reviewChecklist, [key]: event.target.value } })}
                >
                  <option value="">Choose</option>
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                  <option value="NA">N/A</option>
                </select>
              </label>
            ))}
          </div>
        ) : null}

        <div style={{ ...styles.row, marginTop: 12 }}>
          <Field label={entry.recordType === "DAILY_DIARY" ? "Problems or changes - what happened?" : "Notes / how did you prove it?"} width={360} grow={2}>
            <textarea style={styles.area} value={entry.notes} onChange={(event) => setEntry({ ...entry, notes: event.target.value })} />
          </Field>
          <Field label="Corrective action taken" width={360} grow={2} help="Required for any failed entry.">
            <textarea style={styles.area} value={entry.correctiveActionTaken} onChange={(event) => setEntry({ ...entry, correctiveActionTaken: event.target.value })} />
          </Field>
          <Field label="How recurrence will be prevented" width={360} grow={2}>
            <textarea style={styles.area} value={entry.preventionActionTaken} onChange={(event) => setEntry({ ...entry, preventionActionTaken: event.target.value })} />
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button style={button("#16a34a", "#fff")} onClick={saveEvidence} disabled={saving || !site}><FaSave /> Save evidence</button>
        </div>
      </div>

      <div style={{ ...styles.card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["METHODS", "Safe methods", FaBookOpen],
            ["DISHES", "By dish", FaUtensils],
            ["EVIDENCE", "Evidence log", FaHistory],
          ].map(([value, label, Icon]) => (
            <button key={value} style={button(viewMode === value ? "#2563eb" : "#fff", viewMode === value ? "#fff" : "#111827")} onClick={() => setViewMode(value)}>
              <Icon /> {label}
            </button>
          ))}
        </div>
        <div style={{ ...styles.row, flex: "1 1 420px", justifyContent: "flex-end" }}>
          <label style={{ flex: "1 1 280px", position: "relative" }}>
            <FaSearch style={{ position: "absolute", left: 12, top: 13, color: "#6b7280" }} />
            <input style={{ ...styles.input, paddingLeft: 34 }} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search methods, dishes or evidence" />
          </label>
          {viewMode === "METHODS" ? (
            <select style={{ ...styles.input, width: 180 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="OK">Ready</option>
              <option value="ACTION">Draft / action</option>
              <option value="DUE">Evidence / review due</option>
              <option value="FAIL">Failed checks</option>
              <option value="NA">Not relevant</option>
            </select>
          ) : null}
        </div>
      </div>

      {viewMode === "METHODS" ? (
        <div style={styles.card}>
          <div style={styles.header}><FaThermometerHalf color="#16a34a" /> Safe methods, checks and current status</div>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#f8fafc" }}>
                {['Method', 'Completion', 'Limit / monitoring', 'Latest evidence', 'Status', ''].map((heading) => <th key={heading} style={{ ...styles.tableCell, textAlign: "left", whiteSpace: "nowrap" }}>{heading}</th>)}
              </tr></thead>
              <tbody>
                {filteredRows.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr>
                      <td style={styles.tableCell}><strong>{row.method.name}</strong><br /><span style={styles.help}>{row.method.category} · {row.method.hazardTypes.join(", ")}</span></td>
                      <td style={styles.tableCell}><strong>{row.completion.percent}%</strong><br /><span style={styles.help}>{row.completion.missing.length ? `${row.completion.missing.length} item(s) missing` : "Signed off"}</span></td>
                      <td style={styles.tableCell}>{row.method.limitText || [row.method.limitMin && `Min ${row.method.limitMin}°C`, row.method.limitMax && `Max ${row.method.limitMax}°C`].filter(Boolean).join(" · ") || "No numeric limit"}<br /><span style={styles.help}>{row.method.monitoringMethod || "No method"} · {row.method.monitoringFrequency}</span></td>
                      <td style={styles.tableCell}>{row.latestEvidenceDate ? formatDate(row.latestEvidenceDate) : "None"}<br /><span style={styles.help}>{row.latestCheck ? `${row.latestCheck.result} by ${row.latestCheck.completedBy || "unknown"}` : row.equipmentEvidence.length ? "Equipment record" : "No evidence"}</span></td>
                      <td style={styles.tableCell}>{statusBadge(row.status)}<div style={{ ...styles.help, maxWidth: 230 }}>{row.statusReason}</div></td>
                      <td style={styles.tableCell}><button style={button()} onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}><FaEye /> {expandedId === row.id ? "Close" : "Explore"}</button></td>
                    </tr>
                    {expandedId === row.id ? (
                      <tr><td colSpan={6} style={{ ...styles.tableCell, background: "#f8fafc" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, lineHeight: 1.5 }}>
                          <div><strong>How this site does it</strong><br />{row.method.businessProcedure || "Not documented"}</div>
                          <div><strong>Check it</strong><br />{row.method.checkMethod || "Not documented"}</div>
                          <div><strong>If things go wrong</strong><br />{row.method.correctiveAction || "Not documented"}</div>
                          <div><strong>Prevent recurrence</strong><br />{row.method.preventionAction || "Not documented"}</div>
                          <div><strong>Verification / records</strong><br />{row.method.verification || "Not documented"}<br />{row.method.records}</div>
                          <div><strong>Owner / review</strong><br />{row.method.monitoringResponsible || "Not assigned"}<br />Review due: {row.method.reviewDueDate || "not set"}</div>
                        </div>
                        {row.method.safetyChecks.length ? (
                          <div style={{ marginTop: 14 }}>
                            <strong>Safety point / Why / How do you do this?</strong>
                            {row.method.safetyChecks.map((item, index) => (
                              <div key={`${row.id}-safety-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(200px, .8fr) minmax(220px, 1fr)", gap: 10, padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
                                <div>{item.safetyPoint || "-"}</div>
                                <div style={{ color: "#6b7280" }}>{item.whyImportant || "-"}</div>
                                <div><strong>{item.question || "How do you do this?"}</strong><br />{item.answer ? <span style={pill(item.answer === "NO" ? "#fef2f2" : "#ecfdf5", item.answer === "NO" ? "#991b1b" : "#166534")}>{item.answer}</span> : <span style={pill("#fffbeb", "#92400e")}>Not answered</span>}{item.details ? <div style={{ marginTop: 4 }}>{item.details}</div> : null}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </td></tr>
                    ) : null}
                  </React.Fragment>
                ))}
                {!filteredRows.length ? <tr><td colSpan={6} style={{ ...styles.tableCell, textAlign: "center", color: "#6b7280" }}>No methods match this view.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {viewMode === "DISHES" ? (
        <div style={styles.card}>
          <div style={styles.header}><FaUtensils color="#f59e0b" /> Dishes and linked controls</div>
          {dishRows.map((dish) => (
            <div key={dish.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 13, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><strong>{dish.name}</strong>{statusBadge(dish.status)}<span style={styles.help}>{dish.description}</span></div>
              <div style={{ ...styles.row, marginTop: 8 }}>{dish.linked.length ? dish.linked.map((row) => <span key={row.id} style={pill(row.status.background, row.status.color)}>{row.method.name}</span>) : <span style={styles.help}>No safe methods or CCPs linked to this dish or its stock items.</span>}</div>
            </div>
          ))}
          {!dishRows.length ? <div style={{ textAlign: "center", color: "#6b7280" }}>No dishes match this view.</div> : null}
        </div>
      ) : null}

      {viewMode === "EVIDENCE" ? (
        <div style={styles.card}>
          <div style={styles.header}><FaHistory color="#7c3aed" /> Evidence and diary log</div>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#f8fafc" }}>{['Date', 'Type / method', 'Result', 'Completed by', 'Evidence / problem', 'Action taken'].map((heading) => <th key={heading} style={{ ...styles.tableCell, textAlign: "left" }}>{heading}</th>)}</tr></thead>
              <tbody>
                {checksNewestFirst.filter((item) => [item.recordType, item.methodName, item.notes, item.completedBy].join(" ").toLowerCase().includes(searchText.toLowerCase())).map((item) => (
                  <tr key={item.id}>
                    <td style={styles.tableCell}>{formatDate(item.checkedAt || item.createdAt)}</td>
                    <td style={styles.tableCell}><strong>{String(item.recordType || "SAFE_METHOD").replaceAll("_", " ")}</strong><br /><span style={styles.help}>{item.methodName || "General site record"}</span></td>
                    <td style={styles.tableCell}><span style={pill(item.result === "PASS" ? "#ecfdf5" : "#fef2f2", item.result === "PASS" ? "#166534" : "#991b1b")}>{item.result || "-"}</span>{item.observedValue ? <div style={{ marginTop: 4 }}>{item.observedValue} {item.unit}</div> : null}</td>
                    <td style={styles.tableCell}>{item.completedBy || "-"}</td>
                    <td style={styles.tableCell}>{item.notes || (item.recordType === "DAILY_DIARY" ? `Opening: ${item.openingChecksCompleted ? "yes" : "no"}; closing: ${item.closingChecksCompleted ? "yes" : "no"}` : "-")}</td>
                    <td style={styles.tableCell}>{item.correctiveActionTaken || "-"}{item.preventionActionTaken ? <div style={styles.help}>Prevention: {item.preventionActionTaken}</div> : null}</td>
                  </tr>
                ))}
                {!checksNewestFirst.length ? <tr><td colSpan={6} style={{ ...styles.tableCell, textAlign: "center", color: "#6b7280" }}>No evidence has been recorded.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}><button style={button()} onClick={goBack}>Back</button></div>
    </div>
  );
};

export default HaccpDashboard;
