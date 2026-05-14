// src/components/EquipmentManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  FaChevronLeft,
  FaPlus,
  FaTrash,
  FaTools,
  FaThermometerHalf,
  FaSnowflake,
  FaFire,
} from "react-icons/fa";

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

const getDisplayName = (value) => {
  if (!value) return "Unknown";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.name || value.displayName || value.email || value.role || "User";
  }
  return String(value);
};

const typeMeta = (type) => {
  const t = (type || "").toString().toLowerCase();

  if (t === "fridge")
    return {
      label: "Fridge",
      icon: <FaThermometerHalf />,
      bg: "#fee2e2",
      fg: "#991b1b",
    };

  if (t === "freezer")
    return {
      label: "Freezer",
      icon: <FaSnowflake />,
      bg: "#e0f2fe",
      fg: "#075985",
    };

  if (t === "cooking")
    return {
      label: "Cooking",
      icon: <FaFire />,
      bg: "#fef3c7",
      fg: "#92400e",
    };

  return {
    label: "Other",
    icon: <FaTools />,
    bg: "#f3f4f6",
    fg: "#374151",
  };
};

const EquipmentManager = ({
  site,
  user,
  tempChecks = [],
  setTempChecks = () => {},
  goBack = () => {},
}) => {
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("Other");
  const [equipmentList, setEquipmentList] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!site) return;

    const equipmentQuery = query(
      collection(db, "equipment"),
      where("site", "==", site)
    );

    const unsub = onSnapshot(
      equipmentQuery,
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        rows.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });

        setEquipmentList(rows);
        setTempChecks(rows);
      },
      (err) => {
        console.error("Equipment subscribe error:", err);
        setEquipmentList([]);
        setTempChecks([]);
      }
    );

    return () => unsub();
  }, [site, setTempChecks]);

  const canSave = useMemo(() => {
    return equipmentName.trim().length > 0 && !busy && !!site;
  }, [equipmentName, busy, site]);

  const addEquipment = async () => {
    if (!canSave) return;

    setBusy(true);

    const newEquipment = {
      site,
      name: equipmentName.trim(),
      type: equipmentType,
      records: [],
      addedBy: getDisplayName(user),
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "equipment"), newEquipment);
      setEquipmentName("");
      setEquipmentType("Other");
      goBack();
    } catch (error) {
      console.error("Error adding equipment:", error);
      alert("Couldn’t save equipment. Check connection / permissions.");
    } finally {
      setBusy(false);
    }
  };

  const removeEquipment = async (eq) => {
    if (!eq?.id) return;

    const ok = window.confirm(
      `Remove "${eq.name}"? This will delete it from this venue.`
    );

    if (!ok) return;

    setBusy(true);

    try {
      await deleteDoc(doc(db, "equipment", eq.id));

      const next = (tempChecks || []).filter((x) => x.id !== eq.id);
      setTempChecks(next);
    } catch (error) {
      console.error("Error removing equipment:", error);
      alert("Couldn’t remove equipment. Check permissions / connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={goBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          <FaChevronLeft /> Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "#f3f4f6",
              display: "grid",
              placeItems: "center",
            }}
          >
            <FaTools color="#374151" />
          </div>

          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#111" }}>
              Equipment
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {site || "No site selected"}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 800, color: "#111" }}>Add equipment</div>
          <span style={chip("#eef2ff", "#3730a3")}>Saved per venue</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 220px",
            gap: 12,
            marginTop: 14,
          }}
        >
          <input
            type="text"
            placeholder="Equipment name e.g. Fridge 1, Tall Freezer, Griddle"
            value={equipmentName}
            onChange={(e) => setEquipmentName(e.target.value)}
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              outline: "none",
            }}
          />

          <select
            value={equipmentType}
            onChange={(e) => setEquipmentType(e.target.value)}
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <option value="Fridge">Fridge</option>
            <option value="Freezer">Freezer</option>
            <option value="Cooking">Cooking</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <button
            onClick={addEquipment}
            disabled={!canSave}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              background: canSave ? "#2563eb" : "#93c5fd",
              color: "#fff",
              cursor: canSave ? "pointer" : "not-allowed",
              fontWeight: 800,
            }}
          >
            <FaPlus /> {busy ? "Saving..." : "Save equipment"}
          </button>

          <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>
            Tip: Use consistent names e.g. “Fridge 1”, “Fridge 2”.
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 800, color: "#111" }}>
            Existing equipment
          </div>
          <span style={chip("#f3f4f6", "#111827")}>
            {equipmentList.length} item(s)
          </span>
        </div>

        {equipmentList.length === 0 ? (
          <div style={{ marginTop: 14, color: "#6b7280", fontSize: 13 }}>
            No equipment added yet for this venue.
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {equipmentList.map((eq) => {
              const meta = typeMeta(eq.type);

              return (
                <div
                  key={eq.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "center",
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 14,
                        background: meta.bg,
                        color: meta.fg,
                        display: "grid",
                        placeItems: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      {meta.icon}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "#111",
                          fontSize: 15,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {eq.name || "Untitled"}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginTop: 2,
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={chip(meta.bg, meta.fg)}>{meta.label}</span>
                        {eq.addedBy && (
                          <span style={chip("#f3f4f6", "#374151")}>
                            Added by: {getDisplayName(eq.addedBy)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeEquipment(eq)}
                    disabled={busy}
                    title="Remove equipment"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #fee2e2",
                      background: "#fff",
                      color: "#b91c1c",
                      cursor: busy ? "not-allowed" : "pointer",
                      fontWeight: 800,
                    }}
                  >
                    <FaTrash /> Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentManager;