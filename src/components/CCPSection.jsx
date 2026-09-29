import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  FaBookOpen,
  FaBoxOpen,
  FaCheckCircle,
  FaClipboardCheck,
  FaEdit,
  FaExclamationTriangle,
  FaPlus,
  FaSave,
  FaTimes,
  FaTools,
  FaTrash,
  FaUtensils,
} from "react-icons/fa";
import {
  emptySafeMethod,
  getCompletion,
  HAZARD_TYPES,
  MONITORING_FREQUENCIES,
  normaliseSafeMethod,
  SFBB_CATEGORIES,
  SFBB_SAFE_METHODS,
  SFBB_SOURCE_URL,
} from "./sfbbSafeMethods";

const styles = {
  wrap: {
    maxWidth: 1120,
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
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
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
    minHeight: 90,
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  label: { display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 },
  help: { color: "#6b7280", fontSize: 12, lineHeight: 1.45, marginTop: 5 },
  fieldset: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    margin: "14px 0 0",
  },
  legend: { padding: "0 8px", fontSize: 14, fontWeight: 800, color: "#1f2937" },
};

const button = (background = "#f3f4f6", color = "#111827") => ({
  padding: "10px 14px",
  borderRadius: 10,
  border: 0,
  cursor: "pointer",
  background,
  color,
  fontWeight: 700,
  display: "inline-flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "center",
});

const tag = (background = "#eef2ff", color = "#4338ca") => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 9px",
  borderRadius: 999,
  background,
  color,
  fontSize: 12,
  fontWeight: 700,
});

const Field = ({ label, help, children, width = "min(100%, 330px)", grow = 1 }) => (
  <label style={{ display: "block", flex: `${grow} 1 ${width}`, minWidth: 220 }}>
    <span style={styles.label}>{label}</span>
    {children}
    {help ? <div style={styles.help}>{help}</div> : null}
  </label>
);

const completionColour = (percent) => {
  if (percent === 100) return ["#ecfdf5", "#166534"];
  if (percent >= 65) return ["#fffbeb", "#92400e"];
  return ["#fef2f2", "#991b1b"];
};

const cleanPayload = (source) => {
  const normalised = normaliseSafeMethod(source);
  return Object.keys(emptySafeMethod()).reduce((payload, key) => {
    payload[key] = normalised[key];
    return payload;
  }, {});
};

const MethodForm = ({ value, onChange, equipment, stockItems, dishes, idPrefix }) => {
  const set = (key, nextValue) => onChange({ ...value, [key]: nextValue });
  const toggleHazard = (hazard) => {
    const current = Array.isArray(value.hazardTypes) ? value.hazardTypes : [];
    const next = current.includes(hazard)
      ? current.filter((item) => item !== hazard)
      : [...current, hazard];
    set("hazardTypes", next);
  };
  const multiValues = (event) => Array.from(event.target.selectedOptions).map((option) => option.value);
  const updateSafetyCheck = (index, key, nextValue) => {
    const nextChecks = (value.safetyChecks || []).map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: nextValue } : item
    );
    set("safetyChecks", nextChecks);
  };
  const addSafetyCheck = () => set("safetyChecks", [
    ...(value.safetyChecks || []),
    {
      safetyPoint: "",
      whyImportant: "",
      question: "",
      responseType: "YES_NO",
      answer: "",
      details: "",
    },
  ]);
  const removeSafetyCheck = (index) =>
    set("safetyChecks", (value.safetyChecks || []).filter((_, itemIndex) => itemIndex !== index));

  return (
    <>
      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>1. Scope and hazard</legend>
        <div style={styles.row}>
          <Field label="Safe method / control name" width="360px" grow={2}>
            <input
              id={`${idPrefix}-name`}
              style={styles.input}
              value={value.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="e.g. Chilled storage and display"
            />
          </Field>
          <Field label="SFBB section">
            <select style={styles.input} value={value.category} onChange={(event) => set("category", event.target.value)}>
              {SFBB_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </Field>
          <Field label="Control type">
            <select
              style={styles.input}
              value={value.controlType}
              onChange={(event) => {
                const controlType = event.target.value;
                onChange({ ...value, controlType, isCCP: controlType === "CCP" });
              }}
            >
              <option>Safe method</option>
              <option>Operational control</option>
              <option>CCP</option>
            </select>
          </Field>
          <Field label="Applicability">
            <select
              style={styles.input}
              value={value.appliesToBusiness ? "APPLIES" : "NOT_RELEVANT"}
              onChange={(event) => set("appliesToBusiness", event.target.value === "APPLIES")}
            >
              <option value="APPLIES">Applies to this site</option>
              <option value="NOT_RELEVANT">Not relevant (recorded)</option>
            </select>
          </Field>
          <Field label="Process step" width="320px" grow={2}>
            <input
              style={styles.input}
              value={value.step}
              onChange={(event) => set("step", event.target.value)}
              placeholder="Delivery, storage, preparation, cook, chill, service..."
            />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <span style={styles.label}>Hazards controlled</span>
          <div style={{ ...styles.row, gap: 8 }}>
            {HAZARD_TYPES.map((hazard) => (
              <label key={hazard} style={{ ...tag("#f8fafc", "#334155"), cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={(value.hazardTypes || []).includes(hazard)}
                  onChange={() => toggleHazard(hazard)}
                />
                {hazard}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>2. SFBB safe method</legend>
        <div style={styles.row}>
          <Field label="Safety point" width="420px">
            <textarea style={styles.area} value={value.safetyPoint} onChange={(event) => set("safetyPoint", event.target.value)} />
          </Field>
          <Field label="Why is this important?" width="420px">
            <textarea style={styles.area} value={value.whyImportant} onChange={(event) => set("whyImportant", event.target.value)} />
          </Field>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={styles.label}>Safety-point checklist</div>
              <div style={styles.help}>Keep each SFBB point separate so the site must answer it rather than signing off a broad paragraph.</div>
            </div>
            <button type="button" style={{ ...button(), marginLeft: "auto" }} onClick={addSafetyCheck}>
              <FaPlus /> Add safety point
            </button>
          </div>
          {(value.safetyChecks || []).length === 0 ? (
            <div style={{ ...styles.help, padding: 12, background: "#f8fafc", borderRadius: 10 }}>
              No itemised questions yet. Add the individual safety points an inspector or manager should be able to verify.
            </div>
          ) : (value.safetyChecks || []).map((item, index) => (
            <div key={`${idPrefix}-safety-${index}`} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <strong>Safety point {index + 1}</strong>
                <button
                  type="button"
                  style={{ ...button("#fef2f2", "#991b1b"), padding: "7px 10px", marginLeft: "auto" }}
                  onClick={() => removeSafetyCheck(index)}
                >
                  <FaTrash /> Remove
                </button>
              </div>
              <div style={styles.row}>
                <Field label="Safety point" width="360px">
                  <textarea
                    style={styles.area}
                    value={item.safetyPoint || ""}
                    onChange={(event) => updateSafetyCheck(index, "safetyPoint", event.target.value)}
                  />
                </Field>
                <Field label="Why?" width="360px">
                  <textarea
                    style={styles.area}
                    value={item.whyImportant || ""}
                    onChange={(event) => updateSafetyCheck(index, "whyImportant", event.target.value)}
                  />
                </Field>
              </div>
              <div style={{ ...styles.row, marginTop: 10 }}>
                <Field label="How do you do this? / inspection question" width="360px" grow={2}>
                  <input
                    style={styles.input}
                    value={item.question || ""}
                    onChange={(event) => updateSafetyCheck(index, "question", event.target.value)}
                  />
                </Field>
                <Field label="Answer type">
                  <select
                    style={styles.input}
                    value={item.responseType || "YES_NO"}
                    onChange={(event) => updateSafetyCheck(index, "responseType", event.target.value)}
                  >
                    <option value="YES_NO">Yes / No / N/A</option>
                    <option value="TEXT">Written answer</option>
                  </select>
                </Field>
                <Field label="Site answer" width="300px" grow={2}>
                  {(item.responseType || "YES_NO") === "YES_NO" ? (
                    <select
                      style={styles.input}
                      value={item.answer || ""}
                      onChange={(event) => updateSafetyCheck(index, "answer", event.target.value)}
                    >
                      <option value="">Not answered</option>
                      <option value="YES">Yes</option>
                      <option value="NO">No - action required</option>
                      <option value="NA">Not applicable</option>
                    </select>
                  ) : (
                    <input
                      style={styles.input}
                      value={item.answer || ""}
                      onChange={(event) => updateSafetyCheck(index, "answer", event.target.value)}
                      placeholder="Describe the actual site arrangement"
                    />
                  )}
                </Field>
              </div>
              <div style={{ marginTop: 10 }}>
                <Field label="Evidence, detail or action needed" width="100%">
                  <textarea
                    style={{ ...styles.area, minHeight: 66 }}
                    value={item.details || ""}
                    onChange={(event) => updateSafetyCheck(index, "details", event.target.value)}
                    placeholder="Where it happens, what is supplied, training date, owner/action for a No answer..."
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Field
            label="How do you do this at this site?"
            width="100%"
            help="Be specific: equipment, work area, sequence, product groups and any site-only exceptions. This is the key field an inspector needs to see completed."
          >
            <textarea
              style={{ ...styles.area, minHeight: 120 }}
              value={value.businessProcedure}
              onChange={(event) => set("businessProcedure", event.target.value)}
              placeholder="Describe the actual Newgate process; do not just repeat the safety point."
            />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Check it - how do you know the method worked?" width="100%">
            <textarea style={styles.area} value={value.checkMethod} onChange={(event) => set("checkMethod", event.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>3. Limit and monitoring</legend>
        <div style={styles.row}>
          <Field label="Minimum" help="Use only when a numeric lower limit applies.">
            <input style={styles.input} value={value.limitMin} onChange={(event) => set("limitMin", event.target.value)} placeholder="e.g. 75" />
          </Field>
          <Field label="Maximum" help="Use only when a numeric upper limit applies.">
            <input style={styles.input} value={value.limitMax} onChange={(event) => set("limitMax", event.target.value)} placeholder="e.g. 8" />
          </Field>
          <Field label="Full critical/acceptable limit" width="420px" grow={2}>
            <input
              style={styles.input}
              value={value.limitText}
              onChange={(event) => set("limitText", event.target.value)}
              placeholder="Include temperature, time and any exception that applies"
            />
          </Field>
        </div>
        <div style={{ ...styles.row, marginTop: 12 }}>
          <Field label="Monitoring method" width="360px" grow={2}>
            <input style={styles.input} value={value.monitoringMethod} onChange={(event) => set("monitoringMethod", event.target.value)} />
          </Field>
          <Field label="Frequency">
            <select style={styles.input} value={value.monitoringFrequency} onChange={(event) => set("monitoringFrequency", event.target.value)}>
              {MONITORING_FREQUENCIES.map((frequency) => <option key={frequency}>{frequency}</option>)}
            </select>
          </Field>
          <Field label="Responsible person / role">
            <input
              style={styles.input}
              value={value.monitoringResponsible}
              onChange={(event) => set("monitoringResponsible", event.target.value)}
              placeholder="e.g. chef on duty"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>4. When things go wrong</legend>
        <div style={styles.row}>
          <Field label="What to do immediately" width="420px">
            <textarea style={styles.area} value={value.correctiveAction} onChange={(event) => set("correctiveAction", event.target.value)} />
          </Field>
          <Field label="How to stop it happening again" width="420px">
            <textarea style={styles.area} value={value.preventionAction} onChange={(event) => set("preventionAction", event.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>5. Verification, records and training</legend>
        <div style={styles.row}>
          <Field label="Manager verification" width="420px">
            <textarea
              style={styles.area}
              value={value.verification}
              onChange={(event) => set("verification", event.target.value)}
              placeholder="How a manager confirms this control is followed and effective"
            />
          </Field>
          <Field label="Records retained" width="420px">
            <textarea style={styles.area} value={value.records} onChange={(event) => set("records", event.target.value)} />
          </Field>
          <Field label="Training required" width="420px">
            <textarea style={styles.area} value={value.trainingRequired} onChange={(event) => set("trainingRequired", event.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>6. Completion and review</legend>
        <div style={styles.row}>
          <Field label="Completed by">
            <input style={styles.input} value={value.completedBy} onChange={(event) => set("completedBy", event.target.value)} />
          </Field>
          <Field label="Completion date">
            <input type="date" style={styles.input} value={value.completedDate} onChange={(event) => set("completedDate", event.target.value)} />
          </Field>
          <Field label="Last review date">
            <input type="date" style={styles.input} value={value.reviewDate} onChange={(event) => set("reviewDate", event.target.value)} />
          </Field>
          <Field label="Next review due">
            <input type="date" style={styles.input} value={value.reviewDueDate} onChange={(event) => set("reviewDueDate", event.target.value)} />
          </Field>
          <Field label="Version">
            <input style={styles.input} value={value.version} onChange={(event) => set("version", event.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>7. Links to your operation</legend>
        <div style={styles.row}>
          <Field label="Equipment" help="Use Cmd/Ctrl to select more than one.">
            <select multiple style={{ ...styles.input, minHeight: 120 }} value={value.equipmentIds} onChange={(event) => set("equipmentIds", multiValues(event))}>
              {equipment.map((item) => <option key={item.id} value={item.id}>{item.name || item.type || item.id}</option>)}
            </select>
          </Field>
          <Field label="Stock items" help="Use Cmd/Ctrl to select more than one.">
            <select multiple style={{ ...styles.input, minHeight: 120 }} value={value.stockItemIds} onChange={(event) => set("stockItemIds", multiValues(event))}>
              {stockItems.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
            </select>
          </Field>
          <Field label="Dishes / recipes" help="Use Cmd/Ctrl to select more than one.">
            <select multiple style={{ ...styles.input, minHeight: 120 }} value={value.dishIds} onChange={(event) => set("dishIds", multiValues(event))}>
              {dishes.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
            </select>
          </Field>
        </div>
      </fieldset>
    </>
  );
};

const CCPSection = ({ site, goBack, user }) => {
  const [ccps, setCCPs] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [draft, setDraft] = useState(emptySafeMethod());
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState(null);
  const [filterText, setFilterText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!site) return undefined;
    const listeners = [
      ["haccpPoints", setCCPs],
      ["equipment", setEquipment],
      ["stockItems", setStockItems],
      ["dishes", setDishes],
    ].map(([collectionName, setter]) =>
      onSnapshot(
        query(collection(db, collectionName), where("site", "==", site)),
        (snapshot) => setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        (snapshotError) => setError(snapshotError.message)
      )
    );
    return () => listeners.forEach((unsubscribe) => unsubscribe());
  }, [site]);

  const applyTemplate = (templateKey) => {
    setSelectedTemplate(templateKey);
    const template = SFBB_SAFE_METHODS.find((item) => item.templateKey === templateKey);
    if (template) setDraft(normaliseSafeMethod(template));
  };

  const addMethod = async () => {
    if (!draft.name.trim()) {
      setError("Give the safe method a name before saving it.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addDoc(collection(db, "haccpPoints"), {
        ...cleanPayload(draft),
        name: draft.name.trim(),
        site,
        source: draft.templateKey ? "FSA SFBB caterers pack" : "Site-created",
        sourceUrl: draft.templateKey ? SFBB_SOURCE_URL : "",
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      });
      setDraft(emptySafeMethod());
      setSelectedTemplate("");
      setMessage("Safe method saved as a draft. Complete and sign it before relying on it.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  const installStarterLibrary = async () => {
    const existing = new Set(ccps.map((item) => item.templateKey).filter(Boolean));
    const missing = SFBB_SAFE_METHODS.filter((item) => !existing.has(item.templateKey));
    if (!missing.length) {
      setMessage("All SFBB starter methods are already present.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const batch = writeBatch(db);
      missing.forEach((template) => {
        const ref = doc(collection(db, "haccpPoints"));
        batch.set(ref, {
          ...cleanPayload(template),
          site,
          source: "FSA SFBB caterers pack",
          sourceUrl: SFBB_SOURCE_URL,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
        });
      });
      await batch.commit();
      setMessage(`${missing.length} SFBB starter methods added. They are drafts until you complete the site procedure, owner and sign-off.`);
    } catch (installError) {
      setError(installError.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (ccp) => {
    setEditingId(ccp.id);
    setEdit(normaliseSafeMethod(ccp));
    setError("");
  };

  const saveEdit = async () => {
    if (!editingId || !edit?.name?.trim()) return;
    setBusy(true);
    setError("");
    try {
      await updateDoc(doc(db, "haccpPoints", editingId), {
        ...cleanPayload(edit),
        name: edit.name.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null,
      });
      setEditingId(null);
      setEdit(null);
      setMessage("Safe method updated.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteMethod = async (id) => {
    if (!window.confirm("Delete this safe method/control? Existing evidence records will be retained.")) return;
    try {
      await deleteDoc(doc(db, "haccpPoints", id));
      setMessage("Safe method deleted; evidence records were left intact for audit history.");
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const filtered = useMemo(() => {
    const search = filterText.trim().toLowerCase();
    return ccps
      .filter((item) => categoryFilter === "ALL" || normaliseSafeMethod(item).category === categoryFilter)
      .filter((item) => {
        const methodRecord = normaliseSafeMethod(item);
        return [
          methodRecord.name,
          methodRecord.category,
          methodRecord.step,
          methodRecord.businessProcedure,
          methodRecord.hazardTypes.join(" "),
        ].join(" ").toLowerCase().includes(search);
      })
      .sort((left, right) => {
        const a = normaliseSafeMethod(left);
        const b = normaliseSafeMethod(right);
        return `${a.category}-${a.name}`.localeCompare(`${b.category}-${b.name}`);
      });
  }, [ccps, categoryFilter, filterText]);

  const relevantCount = ccps.filter((item) => normaliseSafeMethod(item).appliesToBusiness).length;
  const completeCount = ccps.filter((item) => getCompletion(item).percent === 100).length;

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>HACCP safe methods - <span style={{ color: "#2563eb" }}>{site}</span></h2>

      <div style={{ ...styles.card, borderLeft: "5px solid #2563eb" }}>
        <div style={styles.header}><FaBookOpen color="#2563eb" /> SFBB completion record</div>
        <p style={{ margin: "0 0 12px", lineHeight: 1.55 }}>
          The starter library follows the safe-method completion record in the FSA caterers pack. It supplies concise control guidance,
          but deliberately leaves the site-specific procedure, responsible role, verification and sign-off for your team to complete.
        </p>
        <div style={{ ...styles.row, alignItems: "center" }}>
          <button style={button("#2563eb", "#fff")} onClick={installStarterLibrary} disabled={busy || !site}>
            <FaPlus /> Add missing SFBB starter methods
          </button>
          <a href={SFBB_SOURCE_URL} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 700 }}>
            Open the FSA pack
          </a>
          <span style={tag()}>{ccps.length} total</span>
          <span style={tag("#ecfeff", "#0e7490")}>{relevantCount} relevant</span>
          <span style={tag("#ecfdf5", "#166534")}>{completeCount} completed</span>
        </div>
      </div>

      {message ? <div style={{ ...styles.card, background: "#ecfdf5", color: "#166534" }}><FaCheckCircle /> {message}</div> : null}
      {error ? <div style={{ ...styles.card, background: "#fef2f2", color: "#991b1b" }}><FaExclamationTriangle /> {error}</div> : null}

      <div style={styles.card}>
        <div style={styles.header}><FaPlus color="#16a34a" /> Add one safe method / CCP</div>
        <div style={{ ...styles.row, alignItems: "end", marginBottom: 8 }}>
          <Field label="Start from an SFBB method" width="430px" grow={2}>
            <select style={styles.input} value={selectedTemplate} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">Blank site-specific method</option>
              {SFBB_CATEGORIES.map((category) => (
                <optgroup key={category} label={category}>
                  {SFBB_SAFE_METHODS.filter((item) => item.category === category).map((item) => (
                    <option key={item.templateKey} value={item.templateKey}>{item.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <button style={button()} onClick={() => { setDraft(emptySafeMethod()); setSelectedTemplate(""); }}>
            <FaTimes /> Clear
          </button>
        </div>
        <MethodForm
          value={draft}
          onChange={setDraft}
          equipment={equipment}
          stockItems={stockItems}
          dishes={dishes}
          idPrefix="new-method"
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button style={button("#16a34a", "#fff")} onClick={addMethod} disabled={busy || !site}>
            <FaSave /> Save draft
          </button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.header}><FaClipboardCheck color="#0ea5e9" /> Your completion record</div>
        <div style={styles.row}>
          <input
            style={{ ...styles.input, flex: "2 1 420px" }}
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="Search method, section, step, hazard or site procedure"
          />
          <select style={{ ...styles.input, flex: "1 1 240px" }} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="ALL">All SFBB sections</option>
            {SFBB_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...styles.card, textAlign: "center", color: "#6b7280" }}>No safe methods match this view.</div>
      ) : filtered.map((ccp) => {
        const methodRecord = normaliseSafeMethod(ccp);
        const completion = getCompletion(methodRecord);
        const [completionBg, completionFg] = completionColour(completion.percent);
        const isEditing = editingId === ccp.id;
        const equipmentNames = methodRecord.equipmentIds.map((id) => equipment.find((item) => item.id === id)?.name).filter(Boolean);
        const stockNames = methodRecord.stockItemIds.map((id) => stockItems.find((item) => item.id === id)?.name).filter(Boolean);
        const dishNames = methodRecord.dishIds.map((id) => dishes.find((item) => item.id === id)?.name).filter(Boolean);

        return (
          <div key={ccp.id} style={styles.card}>
            <div style={{ ...styles.header, marginBottom: 10, flexWrap: "wrap" }}>
              <FaClipboardCheck color="#2563eb" />
              <span>{methodRecord.name || "Unnamed method"}</span>
              <span style={tag()}>{methodRecord.category}</span>
              {methodRecord.isCCP ? <span style={tag("#fff7ed", "#9a3412")}>CCP</span> : null}
              {!methodRecord.appliesToBusiness ? <span style={tag("#f3f4f6", "#4b5563")}>Not relevant</span> : null}
              <span style={{ ...tag(completionBg, completionFg), marginLeft: "auto" }}>{completion.percent}% complete</span>
              {!isEditing ? (
                <>
                  <button style={button()} onClick={() => startEdit(ccp)} title="Edit"><FaEdit /></button>
                  <button style={button("#ef4444", "#fff")} onClick={() => deleteMethod(ccp.id)} title="Delete"><FaTrash /></button>
                </>
              ) : null}
            </div>

            {isEditing && edit ? (
              <>
                <MethodForm
                  value={edit}
                  onChange={setEdit}
                  equipment={equipment}
                  stockItems={stockItems}
                  dishes={dishes}
                  idPrefix={`edit-${ccp.id}`}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                  <button style={button()} onClick={() => { setEditingId(null); setEdit(null); }}><FaTimes /> Cancel</button>
                  <button style={button("#2563eb", "#fff")} onClick={saveEdit} disabled={busy}><FaSave /> Save changes</button>
                </div>
              </>
            ) : (
              <>
                {completion.missing.length ? (
                  <div style={{ background: "#fffbeb", color: "#92400e", borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 12 }}>
                    <strong>Still required:</strong> {completion.missing.join(", ")}.
                  </div>
                ) : null}
                {methodRecord.safetyChecks.length ? (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                    <div style={{ background: "#f8fafc", padding: "9px 12px", fontWeight: 800, fontSize: 13 }}>
                      Itemised safety points ({methodRecord.safetyChecks.filter((item) => String(item.answer || "").trim()).length}/{methodRecord.safetyChecks.length} answered)
                    </div>
                    {methodRecord.safetyChecks.map((item, index) => {
                      const answer = String(item.answer || "").trim();
                      const needsAction = answer === "NO";
                      return (
                        <div key={`${ccp.id}-check-${index}`} style={{ padding: 12, borderTop: index ? "1px solid #e5e7eb" : 0, fontSize: 13, lineHeight: 1.45 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.2fr) minmax(220px, 1fr)", gap: 12 }}>
                            <div><strong>Safety point:</strong> {item.safetyPoint || "-"}<br /><span style={{ color: "#6b7280" }}>Why: {item.whyImportant || "-"}</span></div>
                            <div>
                              <strong>{item.question || "How do you do this?"}</strong><br />
                              <span style={tag(needsAction ? "#fef2f2" : answer ? "#ecfdf5" : "#fffbeb", needsAction ? "#991b1b" : answer ? "#166534" : "#92400e")}>
                                {answer || "Not answered"}
                              </span>
                              {item.details ? <div style={{ marginTop: 5 }}>{item.details}</div> : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12, fontSize: 14, lineHeight: 1.5 }}>
                  <div><strong>Safety point</strong><br />{methodRecord.safetyPoint || "-"}</div>
                  <div><strong>How this site does it</strong><br />{methodRecord.businessProcedure || "Not documented"}</div>
                  <div><strong>Check / limit</strong><br />{methodRecord.checkMethod || "-"}<br />{methodRecord.limitText || ""}</div>
                  <div><strong>Monitoring</strong><br />{methodRecord.monitoringMethod || "-"} · {methodRecord.monitoringFrequency}<br />Owner: {methodRecord.monitoringResponsible || "not assigned"}</div>
                  <div><strong>If it goes wrong</strong><br />{methodRecord.correctiveAction || "-"}</div>
                  <div><strong>Prevent recurrence</strong><br />{methodRecord.preventionAction || "-"}</div>
                  <div><strong>Verification and records</strong><br />{methodRecord.verification || "-"}<br />Records: {methodRecord.records || "-"}</div>
                  <div><strong>Completion / review</strong><br />{methodRecord.completedDate || "Not signed off"} {methodRecord.completedBy ? `by ${methodRecord.completedBy}` : ""}<br />Next review: {methodRecord.reviewDueDate || "not set"}</div>
                </div>
                {(equipmentNames.length || stockNames.length || dishNames.length) ? (
                  <div style={{ ...styles.row, marginTop: 12 }}>
                    {equipmentNames.length ? <span style={tag()}><FaTools /> {equipmentNames.join(", ")}</span> : null}
                    {stockNames.length ? <span style={tag("#ecfeff", "#0e7490")}><FaBoxOpen /> {stockNames.join(", ")}</span> : null}
                    {dishNames.length ? <span style={tag("#fff7ed", "#9a3412")}><FaUtensils /> {dishNames.join(", ")}</span> : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <button style={button()} onClick={goBack}>Back</button>
      </div>
    </div>
  );
};

export default CCPSection;
