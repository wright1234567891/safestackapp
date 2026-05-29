import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { FaPlus, FaTrashAlt, FaTools } from "react-icons/fa";

const OPTION_GROUPS = [
  { key: "measurements", label: "Measurements", examples: "unit, kg, slice, portion" },
  { key: "locations", label: "Locations", examples: "Ambient, Fridge 1, Freezer 1" },
  { key: "wasteReasons", label: "Waste reasons", examples: "Out of date, Spoiled, Damaged" },
  { key: "deliveryStatuses", label: "Delivery statuses", examples: "Posted to stock, Checked, Issue found" },
];

const AdminSection = ({ site, goBack, user }) => {
  const [options, setOptions] = useState([]);
  const [drafts, setDrafts] = useState({});

  const wrap = {
    maxWidth: 1000,
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "'Inter', sans-serif",
    color: "#111",
  };

  const card = {
    background: "#fff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    marginBottom: 18,
  };

  const row = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  };

  const input = {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 14,
    minWidth: 240,
    flex: 1,
  };

  const button = (bg = "#f3f4f6", fg = "#111") => ({
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    backgroundColor: bg,
    color: fg,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  });

  useEffect(() => {
    if (!site) return;

    const q = query(collection(db, "adminOptions"), where("site", "==", site));

    const unsub = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
      setOptions(rows);
    });

    return () => unsub();
  }, [site]);

  const getOptionsForGroup = (groupKey) =>
    options.filter((opt) => opt.group === groupKey);

  const addOption = async (groupKey) => {
    const value = (drafts[groupKey] || "").trim();

    if (!value) {
      alert("Enter a value first.");
      return;
    }

    const exists = options.some(
      (opt) =>
        opt.group === groupKey &&
        opt.label?.toLowerCase().trim() === value.toLowerCase()
    );

    if (exists) {
      alert("That option already exists.");
      return;
    }

    await addDoc(collection(db, "adminOptions"), {
      site,
      group: groupKey,
      label: value,
      value,
      active: true,
      createdAt: serverTimestamp(),
      createdBy: user?.name || user?.email || user?.uid || "Unknown",
    });

    setDrafts((prev) => ({ ...prev, [groupKey]: "" }));
  };

  const deleteOption = async (optionId) => {
    const confirmed = window.confirm("Delete this option?");
    if (!confirmed) return;

    await deleteDoc(doc(db, "adminOptions", optionId));
  };

  return (
    <div style={wrap}>
      <h2 style={{ textAlign: "center", fontSize: 28, marginBottom: 22 }}>
        <FaTools /> Admin — <span style={{ color: "#2563eb" }}>{site}</span>
      </h2>

      {OPTION_GROUPS.map((group) => {
        const groupOptions = getOptionsForGroup(group.key);

        return (
          <div key={group.key} style={card}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
              {group.label}
            </div>

            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
              Examples: {group.examples}
            </div>

            <div style={row}>
              <input
                type="text"
                placeholder={`Add ${group.label.toLowerCase()}`}
                value={drafts[group.key] || ""}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [group.key]: e.target.value }))
                }
                style={input}
              />

              <button onClick={() => addOption(group.key)} style={button("#22c55e", "#fff")}>
                <FaPlus />
                Add
              </button>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {groupOptions.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  No options added yet.
                </div>
              ) : (
                groupOptions.map((opt) => (
                  <div
                    key={opt.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      background: "#f9fafb",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {opt.group}
                      </div>
                    </div>

                    <button
                      onClick={() => deleteOption(opt.id)}
                      style={button("#ef4444", "#fff")}
                    >
                      <FaTrashAlt />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}

      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Next step</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Once these options are added, Stock, Goods In, Waste and other sections can read
          these dropdown values from adminOptions instead of using hardcoded lists.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <button onClick={goBack} style={button()}>
          Back
        </button>
      </div>
    </div>
  );
};

export default AdminSection;