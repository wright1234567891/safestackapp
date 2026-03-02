import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// ---------- style helpers (match your teal/card vibe) ----------
const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f3f3f", // deep teal
    padding: "32px 18px",
    color: "#f3f5f6",
  },
  header: {
    textAlign: "center",
    fontSize: 34,
    fontWeight: 700,
    margin: "10px 0 24px",
    letterSpacing: 0.2,
    fontFamily: "Georgia, serif", // matches your screenshot feel
  },
  shell: {
    maxWidth: 980,
    margin: "0 auto",
  },
  card: {
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 12,
    padding: "18px 18px",
    marginBottom: 16,
    background: "rgba(0,0,0,0.12)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
  },
  equipmentTile: {
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 12,
    padding: "18px",
    marginBottom: 14,
    background: "rgba(0,0,0,0.10)",
    cursor: "pointer",
  },
  tileTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    fontFamily: "Georgia, serif",
  },
  tileSub: {
    opacity: 0.9,
    marginTop: 8,
    marginBottom: 0,
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.14)",
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
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    outline: "none",
  },
  select: {
    flex: "0 1 220px",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    outline: "none",
  },
  button: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  buttonPrimary: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.28)",
    background: "rgba(120, 200, 255, 0.18)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  small: { fontSize: 13, opacity: 0.85 },
  recordLine: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    marginBottom: 10,
    background: "rgba(0,0,0,0.10)",
    cursor: "pointer",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    fontSize: 12,
    opacity: 0.95,
  },
  checkbox: { transform: "scale(1.1)" },
};

// ---------- record type presets ----------
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

// quick helper
const safeName = (user) =>
  typeof user === "string" ? user : user?.name || "Unknown";

const generateId = () => "_" + Math.random().toString(36).slice(2, 10);

// decide if equipment is vac pack
const isVacPackEquipment = (eq) => {
  const name = (eq?.name || "").toLowerCase();
  if (eq?.type === "VacPack") return true; // recommended if you add this type
  return name.includes("vac") || name.includes("pack");
};

const CookingSection = ({ site, user, goBack }) => {
  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);

  // form state
  const [logType, setLogType] = useState("HOT_HOLD");
  const [value, setValue] = useState(""); // °C or text
  const [notes, setNotes] = useState("");

  // vac-pack extras
  const [product, setProduct] = useState("");
  const [useBy, setUseBy] = useState("");
  const [cooledBeforePack, setCooledBeforePack] = useState(true);
  const [sealOk, setSealOk] = useState(true);
  const [cleaned, setCleaned] = useState(false);

  // Fetch equipment on mount (ONLY this site; order by name if you have it)
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        // If you only want Cooking + VacPack, do 2 queries and merge.
        // For now: fetch site equipment and filter client-side by allowed types.
        const q1 = query(collection(db, "equipment"), where("site", "==", site));
        const snapshot = await getDocs(q1);

        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // show cooking gear + vac pack (by type or name match)
        const allowed = data.filter(
          (eq) => eq.type === "Cooking" || isVacPackEquipment(eq)
        );

        // optional: sort by type then name
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

  // set default log types when equipment changes
  useEffect(() => {
    if (!selectedEquipment) return;
    setViewingRecord(null);

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
    if (!selectedEquipment) return;

    // validation: cooking logs should have a value if it’s a temp type
    const needsTemp =
      !selectedIsVacPack &&
      ["HOT_HOLD", "COOLING", "REHEAT"].includes(logType);

    if (needsTemp && !String(value).trim()) return;

    // vac pack: if doing VAC_PACK log, product + use-by is strongly recommended
    if (selectedIsVacPack && logType === "VAC_PACK") {
      if (!product.trim()) return;
      if (!useBy.trim()) return;
    }

    const record = {
      id: generateId(),
      type: logType,
      value: String(value || "").trim(), // may be empty for tick-based logs
      unit: needsTemp || selectedIsVacPack ? (value ? "°C" : "") : "",
      notes: notes.trim(),
      meta: selectedIsVacPack
        ? {
            product: product.trim(),
            useBy: useBy.trim(), // store ISO date string from <input type="date">
            cooledBeforePack,
            sealOk,
            cleaned,
          }
        : {},
      person: safeName(user),
      createdAt: serverTimestamp(),
      // keep your current date/time fields too (easy display without needing timestamp reads)
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
    };

    try {
      const eqRef = doc(db, "equipment", selectedEquipment.id);
      const updatedRecords = [...(selectedEquipment.records || []), record];

      await updateDoc(eqRef, { records: updatedRecords });

      // update local state
      setEquipmentList((prev) =>
        prev.map((eq) =>
          eq.id === selectedEquipment.id ? { ...eq, records: updatedRecords } : eq
        )
      );
      setSelectedEquipment((prev) => ({ ...prev, records: updatedRecords }));

      // reset inputs lightly (keep logType)
      setValue("");
      setNotes("");
      setCleaned(false);
    } catch (error) {
      console.error("Error updating record:", error);
    }
  };

  const resetView = () => {
    setSelectedEquipment(null);
    setViewingRecord(null);
    setValue("");
    setNotes("");
  };

  const viewRecord = (eq, rec) =>
    setViewingRecord({ equipment: eq, record: rec });

  const logTypeOptions = selectedIsVacPack ? VACPACK_TYPES : COOKING_TYPES;

  const renderRecordSummary = (rec) => {
    const typeLabel =
      [...COOKING_TYPES, ...VACPACK_TYPES].find((t) => t.value === rec.type)
        ?.label || rec.type;

    // show meta summary for vac pack
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
      <div style={styles.shell}>
        <div style={styles.header}>{site} - Cooking & Cooling</div>

        {/* LIST VIEW */}
        {!selectedEquipment && !viewingRecord && (
          <div style={styles.card}>
            {equipmentList.length === 0 && (
              <p style={{ margin: 0, opacity: 0.9 }}>
                No cooking/vac pack equipment yet.
              </p>
            )}

            {equipmentList.map((eq) => {
              const vac = isVacPackEquipment(eq);
              const tag = vac ? "Vac Pack" : eq.type;
              return (
                <div
                  key={eq.id}
                  style={styles.equipmentTile}
                  onClick={() => setSelectedEquipment(eq)}
                >
                  <div style={styles.row}>
                    <h3 style={styles.tileTitle}>{eq.name}</h3>
                    <span style={styles.badge}>{tag}</span>
                    <span style={styles.badge}>
                      {(eq.records || []).length} record(s)
                    </span>
                  </div>
                  <p style={styles.tileSub}>
                    Tap to log a check / note.
                  </p>
                </div>
              );
            })}

            <div style={{ textAlign: "center", marginTop: 18 }}>
              <button style={styles.button} onClick={goBack}>
                Back
              </button>
            </div>
          </div>
        )}

        {/* EQUIPMENT DETAIL VIEW */}
        {selectedEquipment && !viewingRecord && (
          <div style={styles.card}>
            <div style={styles.row}>
              <h2 style={{ margin: 0, fontFamily: "Georgia, serif" }}>
                {selectedEquipment.name}
              </h2>
              <span style={styles.badge}>
                {selectedIsVacPack ? "Vac Pack" : "Cooking"}
              </span>
            </div>

            <div style={styles.divider} />

            {/* LOG FORM */}
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

              {/* value input: temp/value for most types */}
              <input
                style={styles.input}
                type="text"
                placeholder={
                  selectedIsVacPack
                    ? "Optional temp (°C) or leave blank"
                    : "Enter temp (°C) or note"
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>

            {/* VAC PACK EXTRA FIELDS */}
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
                  <label style={styles.badge}>
                    <input
                      style={styles.checkbox}
                      type="checkbox"
                      checked={cooledBeforePack}
                      onChange={(e) => setCooledBeforePack(e.target.checked)}
                    />
                    Cooled before packing
                  </label>

                  <label style={styles.badge}>
                    <input
                      style={styles.checkbox}
                      type="checkbox"
                      checked={sealOk}
                      onChange={(e) => setSealOk(e.target.checked)}
                    />
                    Seal OK
                  </label>

                  <label style={styles.badge}>
                    <input
                      style={styles.checkbox}
                      type="checkbox"
                      checked={cleaned}
                      onChange={(e) => setCleaned(e.target.checked)}
                    />
                    Cleaned after use
                  </label>
                </div>

                <p style={{ ...styles.small, marginTop: 10 }}>
                  Tip: “Product + use-by + cooled before packing + seal OK” is the
                  strongest EHO-friendly vac pack record.
                </p>
              </>
            )}

            <div style={{ height: 10 }} />
            <textarea
              style={{ ...styles.input, flex: "1 1 100%", minHeight: 70 }}
              placeholder="Notes (optional) e.g. moved to Tall Fridge, batch ref, any issues"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div style={{ height: 12 }} />
            <div style={styles.row}>
              <button style={styles.buttonPrimary} onClick={addRecord}>
                Add Record
              </button>
              <button style={styles.button} onClick={resetView}>
                Back
              </button>
            </div>

            <div style={styles.divider} />

            {/* RECORDS LIST */}
            <h3 style={{ marginTop: 0, fontFamily: "Georgia, serif" }}>
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
                  <div style={{ fontWeight: 700 }}>
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
          <div style={styles.card}>
            <h2 style={{ marginTop: 0, fontFamily: "Georgia, serif" }}>
              {viewingRecord.equipment.name} - Record
            </h2>

            <div style={styles.divider} />

            <p style={{ marginTop: 0 }}>
              <strong>Type:</strong>{" "}
              {viewingRecord.record.type || "—"}
            </p>
            <p>
              <strong>Value:</strong>{" "}
              {viewingRecord.record.value
                ? `${viewingRecord.record.value}${viewingRecord.record.unit ? ` ${viewingRecord.record.unit}` : ""}`
                : "—"}
            </p>

            {viewingRecord.record?.meta?.product && (
              <>
                <p>
                  <strong>Product:</strong> {viewingRecord.record.meta.product}
                </p>
                <p>
                  <strong>Use-by:</strong> {viewingRecord.record.meta.useBy || "—"}
                </p>
                <p>
                  <strong>Cooled before pack:</strong>{" "}
                  {String(!!viewingRecord.record.meta.cooledBeforePack)}
                </p>
                <p>
                  <strong>Seal OK:</strong>{" "}
                  {String(!!viewingRecord.record.meta.sealOk)}
                </p>
                <p>
                  <strong>Cleaned after use:</strong>{" "}
                  {String(!!viewingRecord.record.meta.cleaned)}
                </p>
              </>
            )}

            {viewingRecord.record.notes && (
              <p>
                <strong>Notes:</strong> {viewingRecord.record.notes}
              </p>
            )}

            <p>
              <strong>Date:</strong> {viewingRecord.record.date}
            </p>
            <p>
              <strong>Time:</strong> {viewingRecord.record.time}
            </p>
            <p>
              <strong>Recorded by:</strong> {viewingRecord.record.person}
            </p>

            <button style={styles.button} onClick={resetView}>
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CookingSection;