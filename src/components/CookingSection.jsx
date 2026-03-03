import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

/** ---- Styles closer to your “Checklists” page (white cards on teal) ---- */
const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f3f3f",
    padding: "28px 16px",
  },
  header: {
    textAlign: "center",
    fontSize: 34,
    fontWeight: 800,
    margin: "10px 0 18px",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  wrap: {
    maxWidth: 980,
    margin: "0 auto",
  },
  panel: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 10px 28px rgba(0,0,0,0.20)",
    border: "1px solid rgba(0,0,0,0.06)",
  },
  tile: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    cursor: "pointer",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  tileTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" },
  tileSub: { margin: "6px 0 0", color: "#334155" },
  badgeRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
  },
  divider: {
    height: 1,
    background: "rgba(15, 23, 42, 0.10)",
    margin: "14px 0",
  },
  row: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    flex: "1 1 260px",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "#ffffff",
    color: "#0f172a",
    outline: "none",
  },
  select: {
    flex: "0 1 260px",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "#ffffff",
    color: "#0f172a",
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "#ffffff",
    color: "#0f172a",
    outline: "none",
    minHeight: 80,
  },
  btnRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 },
  btn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "#f1f5f9",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: 800,
  },
  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#3b82f6",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  hint: { marginTop: 10, fontSize: 13, color: "#475569" },
  error: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(220, 38, 38, 0.25)",
    background: "rgba(220, 38, 38, 0.06)",
    color: "#b91c1c",
    fontWeight: 700,
  },
  ok: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(22, 163, 74, 0.25)",
    background: "rgba(22, 163, 74, 0.06)",
    color: "#15803d",
    fontWeight: 800,
  },
  recordLine: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#ffffff",
    boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
    marginBottom: 10,
    cursor: "pointer",
  },
  small: { fontSize: 13, color: "#475569" },
  checkboxWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#f8fafc",
    fontWeight: 800,
    color: "#0f172a",
  },
};

const COOKING_TYPES = [
  { value: "HOT_HOLD", label: "Hot holding check (°C)" },
  { value: "COOLING", label: "Cooling check (°C)" },
  { value: "REHEAT", label: "Reheat / service check (°C)" },
  { value: "GENERAL", label: "General note" },
];

const VACPACK_TYPES = [
  { value: "VAC_PACK", label: "Vac pack + label" },
  { value: "SEAL_CHECK", label: "Seal integrity check" },
  { value: "CHILL_BEFORE_PACK", label: "Cooled before packing (tick + °C optional)" },
  { value: "CLEANING", label: "Cleaning / sanitise record" },
];

const safeName = (user) =>
  typeof user === "string" ? user : user?.name || "Unknown";

const generateId = () => "_" + Math.random().toString(36).slice(2, 10);

const isVacPackEquipment = (eq) => {
  const name = (eq?.name || "").toLowerCase();
  if (eq?.type === "VacPack") return true;
  return name.includes("vac") || name.includes("pack");
};

const CookingSection = ({ site, user, goBack }) => {
  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);

  const [logType, setLogType] = useState("HOT_HOLD");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  // vac-pack extras
  const [product, setProduct] = useState("");
  const [useBy, setUseBy] = useState("");
  const [cooledBeforePack, setCooledBeforePack] = useState(true);
  const [sealOk, setSealOk] = useState(true);
  const [cleaned, setCleaned] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const q1 = query(collection(db, "equipment"), where("site", "==", site));
        const snapshot = await getDocs(q1);
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        const allowed = data.filter(
          (eq) => eq.type === "Cooking" || isVacPackEquipment(eq)
        );

        allowed.sort((a, b) => {
          const ta = isVacPackEquipment(a) ? "VacPack" : a.type;
          const tb = isVacPackEquipment(b) ? "VacPack" : b.type;
          if (ta !== tb) return ta.localeCompare(tb);
          return (a.name || "").localeCompare(b.name || "");
        });

        setEquipmentList(allowed);
      } catch (error) {
        console.error("Error fetching equipment:", error);
      }
    };
    fetchEquipment();
  }, [site]);

  const selectedIsVacPack = useMemo(
    () => (selectedEquipment ? isVacPackEquipment(selectedEquipment) : false),
    [selectedEquipment]
  );

  useEffect(() => {
    if (!selectedEquipment) return;
    setViewingRecord(null);
    setErr("");
    setOk("");

    if (isVacPackEquipment(selectedEquipment)) {
      setLogType("VAC_PACK");
      setValue("");
      setNotes("");
      setProduct("");
      setUseBy("");
      setCooledBeforePack(true);
      setSealOk(true);
      setCleaned(false);
    } else {
      setLogType("HOT_HOLD");
      setValue("");
      setNotes("");
    }
  }, [selectedEquipment]);

  const addRecord = async () => {
    setErr("");
    setOk("");

    if (!selectedEquipment) return;

    const needsTemp =
      !selectedIsVacPack &&
      ["HOT_HOLD", "COOLING", "REHEAT"].includes(logType);

    if (needsTemp && !String(value).trim()) {
      setErr("Please enter a temperature value.");
      return;
    }

    if (selectedIsVacPack && logType === "VAC_PACK") {
      if (!product.trim()) {
        setErr("Please enter a product name.");
        return;
      }
      if (!useBy.trim()) {
        setErr("Please choose a use-by date.");
        return;
      }
    }

    const now = new Date();

    // ✅ IMPORTANT: Timestamp.now() works in arrays; serverTimestamp() does not.
    const record = {
      id: generateId(),
      type: logType,
      value: String(value || "").trim(),
      unit: (needsTemp || (selectedIsVacPack && value)) ? "°C" : "",
      notes: notes.trim(),
      meta: selectedIsVacPack
        ? {
            product: product.trim(),
            useBy: useBy.trim(),
            cooledBeforePack,
            sealOk,
            cleaned,
          }
        : {},
      person: safeName(user),
      createdAt: Timestamp.now(),
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
    };

    try {
      setSaving(true);

      const eqRef = doc(db, "equipment", selectedEquipment.id);
      const updatedRecords = [...(selectedEquipment.records || []), record];

      await updateDoc(eqRef, { records: updatedRecords });

      setEquipmentList((prev) =>
        prev.map((eq) =>
          eq.id === selectedEquipment.id ? { ...eq, records: updatedRecords } : eq
        )
      );
      setSelectedEquipment((prev) => ({ ...prev, records: updatedRecords }));

      setValue("");
      setNotes("");
      setCleaned(false);
      setOk("Record saved.");
    } catch (error) {
      console.error("Error updating record:", error);
      setErr(error?.message || "Could not save record. Check Firestore rules/console.");
    } finally {
      setSaving(false);
    }
  };

  const resetView = () => {
    setSelectedEquipment(null);
    setViewingRecord(null);
    setValue("");
    setNotes("");
    setErr("");
    setOk("");
  };

  const viewRecord = (eq, rec) =>
    setViewingRecord({ equipment: eq, record: rec });

  const logTypeOptions = selectedIsVacPack ? VACPACK_TYPES : COOKING_TYPES;

  const renderRecordSummary = (rec) => {
    const typeLabel =
      [...COOKING_TYPES, ...VACPACK_TYPES].find((t) => t.value === rec.type)
        ?.label || rec.type;

    let metaBits = "";
    if (rec?.meta?.product) {
      metaBits = ` • ${rec.meta.product}`;
      if (rec.meta.useBy) metaBits += ` • Use-by: ${rec.meta.useBy}`;
      if (typeof rec.meta.sealOk === "boolean")
        metaBits += ` • Seal: ${rec.meta.sealOk ? "OK" : "FAIL"}`;
    }

    const val = rec.value ? `${rec.value}${rec.unit ? ` ${rec.unit}` : ""}` : "";
    return `${typeLabel}${val ? ` • ${val}` : ""}${metaBits}`;
  };

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.header}>{site} - Cooking & Cooling</div>

        {/* LIST VIEW */}
        {!selectedEquipment && !viewingRecord && (
          <div style={styles.panel}>
            {equipmentList.length === 0 && (
              <p style={{ margin: 0, color: "#334155", fontWeight: 700 }}>
                No cooking/vac pack equipment yet.
              </p>
            )}

            {equipmentList.map((eq) => {
              const vac = isVacPackEquipment(eq);
              const tag = vac ? "Vac Pack" : eq.type;

              return (
                <div
                  key={eq.id}
                  style={styles.tile}
                  onClick={() => setSelectedEquipment(eq)}
                >
                  <div style={styles.titleRow}>
                    <h3 style={styles.tileTitle}>{eq.name}</h3>

                    <div style={styles.badgeRow}>
                      <span style={styles.badge}>{tag}</span>
                      <span style={styles.badge}>
                        {(eq.records || []).length} record(s)
                      </span>
                    </div>
                  </div>
                  <p style={styles.tileSub}>Tap to log a check / note.</p>
                </div>
              );
            })}

            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button style={styles.btn} onClick={goBack}>
                Back
              </button>
            </div>
          </div>
        )}

        {/* EQUIPMENT DETAIL VIEW */}
        {selectedEquipment && !viewingRecord && (
          <div style={styles.panel}>
            <div style={styles.titleRow}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
                {selectedEquipment.name}
              </h2>
              <div style={styles.badgeRow}>
                <span style={styles.badge}>
                  {selectedIsVacPack ? "Vac Pack" : "Cooking"}
                </span>
              </div>
            </div>

            <div style={styles.divider} />

            <div style={styles.row}>
              <select
                style={styles.select}
                value={logType}
                onChange={(e) => setLogType(e.target.value)}
              >
                {logTypeOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <input
                style={styles.input}
                type="text"
                placeholder={selectedIsVacPack ? "Optional temp (°C)" : "Enter temp (°C)"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>

            {selectedIsVacPack && (
              <>
                <div style={{ height: 10 }} />
                <div style={styles.row}>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="Product (e.g. Pulled brisket, Pulled pork)"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                  />
                  <input
                    style={styles.input}
                    type="date"
                    value={useBy}
                    onChange={(e) => setUseBy(e.target.value)}
                    title="Use-by date"
                  />
                </div>

                <div style={{ height: 10 }} />
                <div style={styles.row}>
                  <label style={styles.checkboxWrap}>
                    <input
                      type="checkbox"
                      checked={cooledBeforePack}
                      onChange={(e) => setCooledBeforePack(e.target.checked)}
                    />
                    Cooled before packing
                  </label>

                  <label style={styles.checkboxWrap}>
                    <input
                      type="checkbox"
                      checked={sealOk}
                      onChange={(e) => setSealOk(e.target.checked)}
                    />
                    Seal OK
                  </label>

                  <label style={styles.checkboxWrap}>
                    <input
                      type="checkbox"
                      checked={cleaned}
                      onChange={(e) => setCleaned(e.target.checked)}
                    />
                    Cleaned after use
                  </label>
                </div>

                <div style={styles.hint}>
                  Tip: “Product + use-by + cooled before packing + seal OK” is your strongest EHO record.
                </div>
              </>
            )}

            <div style={{ height: 10 }} />
            <textarea
              style={styles.textarea}
              placeholder="Notes (optional) e.g. moved to Tall Fridge, batch ref, any issues"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div style={styles.btnRow}>
              <button style={styles.btnPrimary} onClick={addRecord} disabled={saving}>
                {saving ? "Saving..." : "Add Record"}
              </button>
              <button style={styles.btn} onClick={resetView}>
                Back
              </button>
            </div>

            {!!err && <div style={styles.error}>{err}</div>}
            {!!ok && <div style={styles.ok}>{ok}</div>}

            <div style={styles.divider} />

            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
              Previous Records
            </h3>

            {(selectedEquipment.records || [])
              .slice()
              .reverse()
              .map((rec) => (
                <div
                  key={rec.id}
                  style={styles.recordLine}
                  onClick={() => viewRecord(selectedEquipment, rec)}
                >
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                    {renderRecordSummary(rec)}
                  </div>
                  <div style={styles.small}>
                    {rec.date} {rec.time} • {rec.person}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* RECORD VIEW */}
        {viewingRecord && (
          <div style={styles.panel}>
            <h2 style={{ marginTop: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
              {viewingRecord.equipment.name} - Record
            </h2>

            <div style={styles.divider} />

            <p><strong>Type:</strong> {viewingRecord.record.type || "—"}</p>
            <p>
              <strong>Value:</strong>{" "}
              {viewingRecord.record.value
                ? `${viewingRecord.record.value}${viewingRecord.record.unit ? ` ${viewingRecord.record.unit}` : ""}`
                : "—"}
            </p>

            {viewingRecord.record?.meta?.product && (
              <>
                <p><strong>Product:</strong> {viewingRecord.record.meta.product}</p>
                <p><strong>Use-by:</strong> {viewingRecord.record.meta.useBy || "—"}</p>
                <p><strong>Cooled before pack:</strong> {String(!!viewingRecord.record.meta.cooledBeforePack)}</p>
                <p><strong>Seal OK:</strong> {String(!!viewingRecord.record.meta.sealOk)}</p>
                <p><strong>Cleaned after use:</strong> {String(!!viewingRecord.record.meta.cleaned)}</p>
              </>
            )}

            {viewingRecord.record.notes && (
              <p><strong>Notes:</strong> {viewingRecord.record.notes}</p>
            )}

            <p><strong>Date:</strong> {viewingRecord.record.date}</p>
            <p><strong>Time:</strong> {viewingRecord.record.time}</p>
            <p><strong>Recorded by:</strong> {viewingRecord.record.person}</p>

            <button style={styles.btn} onClick={resetView}>
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CookingSection;