// src/components/CCPSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import {
  FaPlus,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaThermometerHalf,
  FaTools,
  FaBoxOpen,
  FaTrash,
  FaEdit,
  FaSave,
  FaTimes,
} from "react-icons/fa";

const CCPSection = ({ site, goBack, user }) => {
  // Data
  const [ccps, setCCPs] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [stockItems, setStockItems] = useState([]);

  // Create form
  const [newCCP, setNewCCP] = useState({
    name: "",
    hazardType: "Biological",
    isCCP: true,
    step: "",
    // limits: flexible: numeric min/max or free text (e.g., “≤5°C”, “≥75°C for 30s”)
    limitMin: "",
    limitMax: "",
    limitText: "",
    monitoringMethod: "",
    monitoringFrequency: "Daily",
    monitoringResponsible: "",
    correctiveAction: "",
    verification: "",
    records: "",
    equipmentIds: [],
    stockItemIds: [],
  });

  // UI
  const [filterText, setFilterText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState(null); // clone of editing CCP

  // Styles (match your StockSection/Checklist vibe)
  const wrap = {
    maxWidth: "980px",
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "'Inter', sans-serif",
    color: "#111",
  };
  const title = {
    fontSize: "28px",
    fontWeight: 700,
    marginBottom: "22px",
    textAlign: "center",
  };
  const card = {
    background: "#fff",
    borderRadius: "14px",
    padding: "18px 18px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    marginBottom: "18px",
  };
  const sectionHeader = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontWeight: 700,
    fontSize: "16px",
    marginBottom: "14px",
  };
  const row = {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  };
  const input = {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    minWidth: "180px",
    background: "#fff",
  };
  const area = {
    ...input,
    minWidth: "280px",
    width: "100%",
    minHeight: 72,
    resize: "vertical",
  };
  const selectInput = { ...input };
  const checkboxLabel = { display: "inline-flex", alignItems: "center", gap: 8 };
  const button = (bg = "#f3f4f6", fg = "#111") => ({
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    backgroundColor: bg,
    color: fg,
    fontWeight: 600,
    transition: "all .2s",
  });
  const primaryBtn = button("#22c55e", "#fff");
  const blueBtn = button("#2563eb", "#fff");
  const orangeBtn = button("#f97316", "#fff");
  const redBtn = button("#ef4444", "#fff");
  const grayBtn = button();
  const subtle = { fontSize: "13px", color: "#6b7280" };
  const tag = (bg = "#eef2ff", fg = "#4338ca") => ({
    padding: "4px 8px",
    borderRadius: "999px",
    background: bg,
    color: fg,
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  });

  // Listeners
  useEffect(() => {
    if (!site) return;
    const qCCP = query(collection(db, "haccpPoints"), where("site", "==", site));
    const unsub = onSnapshot(qCCP, (snap) => {
      setCCPs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const qEq = query(collection(db, "equipment"), where("site", "==", site));
    const unsub = onSnapshot(qEq, (snap) => {
      setEquipment(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const qStock = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub = onSnapshot(qStock, (snap) => {
      setStockItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [site]);

  // Helpers
  const resetNew = () =>
    setNewCCP({
      name: "",
      hazardType: "Biological",
      isCCP: true,
      step: "",
      limitMin: "",
      limitMax: "",
      limitText: "",
      monitoringMethod: "",
      monitoringFrequency: "Daily",
      monitoringResponsible: "",
      correctiveAction: "",
      verification: "",
      records: "",
      equipmentIds: [],
      stockItemIds: [],
    });

  const startEdit = (ccp) => {
    setEditingId(ccp.id);
    setEdit({
      name: ccp.name ?? "",
      hazardType: ccp.hazardType ?? "Biological",
      isCCP: typeof ccp.isCCP === "boolean" ? ccp.isCCP : true,
      step: ccp.step ?? "",
      limitMin: ccp.limitMin ?? "",
      limitMax: ccp.limitMax ?? "",
      limitText: ccp.limitText ?? "",
      monitoringMethod: ccp.monitoringMethod ?? "",
      monitoringFrequency: ccp.monitoringFrequency ?? "Daily",
      monitoringResponsible: ccp.monitoringResponsible ?? "",
      correctiveAction: ccp.correctiveAction ?? "",
      verification: ccp.verification ?? "",
      records: ccp.records ?? "",
      equipmentIds: ccp.equipmentIds ?? [],
      stockItemIds: ccp.stockItemIds ?? [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
  };

  const saveEdit = async (id) => {
    if (!edit?.name?.trim()) return;
    const ref = doc(db, "haccpPoints", id);
    await updateDoc(ref, {
      ...edit,
      name: edit.name.trim(),
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    });
    cancelEdit();
  };

  const addCCP = async () => {
    if (!newCCP.name.trim()) return;
    await addDoc(collection(db, "haccpPoints"), {
      ...newCCP,
      name: newCCP.name.trim(),
      site,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });
    resetNew();
  };

  const deleteCCP = async (id) => {
    if (!window.confirm("Are you sure you want to delete this CCP?")) return;
    await deleteDoc(doc(db, "haccpPoints", id));
  };

  const filtered = useMemo(() => {
    const f = filterText.toLowerCase();
    return ccps.filter((c) => {
      const bucket = [
        c.name,
        c.hazardType,
        c.step,
        ...(c.limitText ? [c.limitText] : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return bucket.includes(f);
    });
  }, [ccps, filterText]);

  // Render pieces
  const LimitsHint = () => (
    <div style={{ ...subtle, marginTop: 4 }}>
      Use either numeric range (min/max) or a text rule (e.g. “Cook ≥ 75°C” / “Chill ≤ 5°C”).
    </div>
  );

  const CCPCard = ({ ccp }) => {
    const isEditing = editingId === ccp.id;

    const val = (k) =>
      isEditing ? edit?.[k] : ccp?.[k] ?? (k === "isCCP" ? true : "");

    const setVal = (k, v) =>
      setEdit((prev) => ({ ...prev, [k]: v }));

    const checkbox = (k) => (
      <label style={checkboxLabel}>
        <input
          type="checkbox"
          checked={!!val(k)}
          onChange={(e) => setVal(k, e.target.checked)}
        />
        CCP?
      </label>
    );

    return (
      <div style={card}>
        <div style={sectionHeader}>
          <FaClipboardCheck color="#2563eb" />
          <span style={{ fontWeight: 800 }}>
            {isEditing ? (
              <input
                style={{ ...input, minWidth: 240 }}
                value={val("name")}
                onChange={(e) => setVal("name", e.target.value)}
                placeholder="CCP name"
              />
            ) : (
              ccp.name || "(Unnamed CCP)"
            )}
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {isEditing ? (
              <>
                <button
                  onClick={() => saveEdit(ccp.id)}
                  style={blueBtn}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
                  title="Save"
                >
                  <FaSave />
                </button>
                <button
                  onClick={cancelEdit}
                  style={grayBtn}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
                  title="Cancel"
                >
                  <FaTimes />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startEdit(ccp)}
                  style={grayBtn}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
                  title="Edit"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => deleteCCP(ccp.id)}
                  style={redBtn}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#dc2626")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
                  title="Delete"
                >
                  <FaTrash />
                </button>
              </>
            )}
          </span>
        </div>

        {/* Row 1: Basics */}
        <div style={{ ...row, marginBottom: 8 }}>
          <select
            disabled={!isEditing}
            value={val("hazardType") || "Biological"}
            onChange={(e) => setVal("hazardType", e.target.value)}
            style={selectInput}
            title="Hazard Type"
          >
            <option>Biological</option>
            <option>Chemical</option>
            <option>Physical</option>
            <option>Allergen</option>
          </select>

          <input
            disabled={!isEditing}
            style={{ ...input, minWidth: 240, flex: 1 }}
            placeholder="Process step (e.g., Cook / Chill / Hot Hold)"
            value={val("step")}
            onChange={(e) => setVal("step", e.target.value)}
          />

          <div style={{ ...tag("#ecfeff", "#0891b2") }}>
            <FaExclamationTriangle />
            {val("isCCP") ? "Critical Control Point" : "Not a CCP"}
          </div>

          {isEditing && checkbox("isCCP")}
        </div>

        {/* Row 2: Limits */}
        <div style={{ ...row, marginTop: 2 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ ...tag("#f0f9ff", "#0369a1") }}>
              <FaThermometerHalf />
              Limits
            </span>
            <input
              disabled={!isEditing}
              style={{ ...input, width: 120 }}
              placeholder="Min (°C)"
              value={val("limitMin")}
              onChange={(e) => setVal("limitMin", e.target.value)}
            />
            <input
              disabled={!isEditing}
              style={{ ...input, width: 120 }}
              placeholder="Max (°C)"
              value={val("limitMax")}
              onChange={(e) => setVal("limitMax", e.target.value)}
            />
            <input
              disabled={!isEditing}
              style={{ ...input, minWidth: 220, flex: 1 }}
              placeholder='Or text (e.g. "Cook ≥ 75°C for 30s")'
              value={val("limitText")}
              onChange={(e) => setVal("limitText", e.target.value)}
            />
          </div>
          <LimitsHint />
        </div>

        {/* Row 3: Monitoring */}
        <div style={{ ...row, marginTop: 10 }}>
          <input
            disabled={!isEditing}
            style={{ ...input, minWidth: 220, flex: 1 }}
            placeholder="Monitoring method (e.g., probe reading)"
            value={val("monitoringMethod")}
            onChange={(e) => setVal("monitoringMethod", e.target.value)}
          />
          <select
            disabled={!isEditing}
            style={{ ...selectInput, minWidth: 180 }}
            value={val("monitoringFrequency") || "Daily"}
            onChange={(e) => setVal("monitoringFrequency", e.target.value)}
            title="Monitoring frequency"
          >
            <option>Per batch</option>
            <option>Per delivery</option>
            <option>Per service</option>
            <option>Hourly</option>
            <option>Twice daily</option>
            <option>Daily</option>
            <option>Weekly</option>
          </select>
          <input
            disabled={!isEditing}
            style={{ ...input, minWidth: 180 }}
            placeholder="Responsible person/role"
            value={val("monitoringResponsible")}
            onChange={(e) => setVal("monitoringResponsible", e.target.value)}
          />
        </div>

        {/* Row 4: Corrective / Verification / Records */}
        <div style={{ ...row, marginTop: 10 }}>
          <textarea
            disabled={!isEditing}
            style={area}
            placeholder="Corrective action (what to do if limits fail)"
            value={val("correctiveAction")}
            onChange={(e) => setVal("correctiveAction", e.target.value)}
          />
          <textarea
            disabled={!isEditing}
            style={area}
            placeholder="Verification (how managers verify monitoring)"
            value={val("verification")}
            onChange={(e) => setVal("verification", e.target.value)}
          />
          <textarea
            disabled={!isEditing}
            style={area}
            placeholder="Records (what records are kept, where)"
            value={val("records")}
            onChange={(e) => setVal("records", e.target.value)}
          />
        </div>

        {/* Row 5: Links */}
        <div style={{ ...row, marginTop: 10, alignItems: "center" }}>
          <span style={tag()}>
            <FaTools /> Equipment
          </span>
          <select
            multiple
            disabled={!isEditing}
            style={{ ...selectInput, minWidth: 240, height: 110 }}
            value={val("equipmentIds") || []}
            onChange={(e) =>
              setVal(
                "equipmentIds",
                Array.from(e.target.selectedOptions).map((o) => o.value)
              )
            }
            title="Link to equipment (hold Ctrl/Cmd to select multiple)"
          >
            {equipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name || eq.type || eq.id}
              </option>
            ))}
          </select>

          <span style={tag("#ecfeff", "#0891b2")}>
            <FaBoxOpen /> Stock Items
          </span>
          <select
            multiple
            disabled={!isEditing}
            style={{ ...selectInput, minWidth: 280, height: 110, flex: 1 }}
            value={val("stockItemIds") || []}
            onChange={(e) =>
              setVal(
                "stockItemIds",
                Array.from(e.target.selectedOptions).map((o) => o.value)
              )
            }
            title="Link to stock items (hold Ctrl/Cmd to select multiple)"
          >
            {stockItems.map((si) => (
              <option key={si.id} value={si.id}>
                {si.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div style={wrap}>
      <h2 style={title}>
        Manage CCPs — <span style={{ color: "#2563eb" }}>{site}</span>
      </h2>

      {/* Create */}
      <div style={card}>
        <div style={sectionHeader}>
          <FaPlus color="#16a34a" />
          Add CCP / Control Measure
        </div>

        <div style={row}>
          <input
            style={{ ...input, minWidth: 260, flex: 1 }}
            placeholder="CCP name (e.g., Cook to Safe Temperature)"
            value={newCCP.name}
            onChange={(e) => setNewCCP((p) => ({ ...p, name: e.target.value }))}
          />
          <select
            style={selectInput}
            value={newCCP.hazardType}
            onChange={(e) => setNewCCP((p) => ({ ...p, hazardType: e.target.value }))}
          >
            <option>Biological</option>
            <option>Chemical</option>
            <option>Physical</option>
            <option>Allergen</option>
          </select>
          <input
            style={{ ...input, minWidth: 220 }}
            placeholder="Process step (e.g., Cook / Chill / Hot Hold)"
            value={newCCP.step}
            onChange={(e) => setNewCCP((p) => ({ ...p, step: e.target.value }))}
          />
          <label style={checkboxLabel} title="Is this a Critical Control Point?">
            <input
              type="checkbox"
              checked={newCCP.isCCP}
              onChange={(e) => setNewCCP((p) => ({ ...p, isCCP: e.target.checked }))}
            />
            CCP?
          </label>
        </div>

        <div style={{ ...row, marginTop: 8 }}>
          <input
            style={{ ...input, width: 120 }}
            placeholder="Min (°C)"
            value={newCCP.limitMin}
            onChange={(e) => setNewCCP((p) => ({ ...p, limitMin: e.target.value }))}
          />
          <input
            style={{ ...input, width: 120 }}
            placeholder="Max (°C)"
            value={newCCP.limitMax}
            onChange={(e) => setNewCCP((p) => ({ ...p, limitMax: e.target.value }))}
          />
          <input
            style={{ ...input, minWidth: 260, flex: 1 }}
            placeholder='Or text (e.g. "Cook ≥ 75°C for 30s")'
            value={newCCP.limitText}
            onChange={(e) => setNewCCP((p) => ({ ...p, limitText: e.target.value }))}
          />
        </div>
        <div style={{ ...subtle, marginTop: 4 }}>
          You can use numeric min/max, text, or both.
        </div>

        <div style={{ ...row, marginTop: 10 }}>
          <input
            style={{ ...input, minWidth: 220, flex: 1 }}
            placeholder="Monitoring method"
            value={newCCP.monitoringMethod}
            onChange={(e) => setNewCCP((p) => ({ ...p, monitoringMethod: e.target.value }))}
          />
          <select
            style={{ ...selectInput, minWidth: 180 }}
            value={newCCP.monitoringFrequency}
            onChange={(e) => setNewCCP((p) => ({ ...p, monitoringFrequency: e.target.value }))}
          >
            <option>Per batch</option>
            <option>Per delivery</option>
            <option>Per service</option>
            <option>Hourly</option>
            <option>Twice daily</option>
            <option>Daily</option>
            <option>Weekly</option>
          </select>
          <input
            style={{ ...input, minWidth: 180 }}
            placeholder="Responsible person/role"
            value={newCCP.monitoringResponsible}
            onChange={(e) => setNewCCP((p) => ({ ...p, monitoringResponsible: e.target.value }))}
          />
        </div>

        <div style={{ ...row, marginTop: 10 }}>
          <textarea
            style={area}
            placeholder="Corrective action (what to do if limits fail)"
            value={newCCP.correctiveAction}
            onChange={(e) => setNewCCP((p) => ({ ...p, correctiveAction: e.target.value }))}
          />
          <textarea
            style={area}
            placeholder="Verification (how managers verify monitoring)"
            value={newCCP.verification}
            onChange={(e) => setNewCCP((p) => ({ ...p, verification: e.target.value }))}
          />
          <textarea
            style={area}
            placeholder="Records (what records are kept, where)"
            value={newCCP.records}
            onChange={(e) => setNewCCP((p) => ({ ...p, records: e.target.value }))}
          />
        </div>

        <div style={{ ...row, marginTop: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={tag()}>
              <FaTools /> Equipment
            </span>
            <select
              multiple
              style={{ ...selectInput, minWidth: 260, height: 110 }}
              value={newCCP.equipmentIds}
              onChange={(e) =>
                setNewCCP((p) => ({
                  ...p,
                  equipmentIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                }))
              }
              title="Link to equipment (hold Ctrl/Cmd to select multiple)"
            >
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name || eq.type || eq.id}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
            <span style={tag("#ecfeff", "#0891b2")}>
              <FaBoxOpen /> Stock Items
            </span>
            <select
              multiple
              style={{ ...selectInput, minWidth: 280, height: 110, flex: 1 }}
              value={newCCP.stockItemIds}
              onChange={(e) =>
                setNewCCP((p) => ({
                  ...p,
                  stockItemIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                }))
              }
              title="Link to stock items (hold Ctrl/Cmd to select multiple)"
            >
              {stockItems.map((si) => (
                <option key={si.id} value={si.id}>
                  {si.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={addCCP}
            style={primaryBtn}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#16a34a")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#22c55e")}
          >
            Add
          </button>
        </div>
      </div>

      {/* Search / Filter */}
      <div style={card}>
        <div style={sectionHeader}>
          <FaClipboardCheck color="#0ea5e9" />
          Your CCPs / Control Measures
        </div>
        <input
          style={{ ...input, width: "100%" }}
          placeholder="Search by name, step, hazard…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ ...subtle, textAlign: "center" }}>No CCPs yet.</div>
      ) : (
        filtered.map((c) => <CCPCard key={c.id} ccp={c} />)
      )}

      {/* Back */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <button
          onClick={goBack}
          style={grayBtn}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default CCPSection;