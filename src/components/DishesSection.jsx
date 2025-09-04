// src/components/DishesSection.jsx
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

// ===== Shared inline styles (matching your app) =====
const wrap = {
  maxWidth: "980px",
  margin: "0 auto",
  padding: "40px 20px",
  fontFamily: "'Inter', sans-serif",
  color: "#111",
};
const title = { fontSize: "28px", fontWeight: 700, marginBottom: "22px", textAlign: "center" };
const card = { background: "#fff", borderRadius: "14px", padding: "18px", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", marginBottom: "18px" };
const row = { display: "flex", gap: 10, flexWrap: "wrap" };
const input = { padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: 14, outline: "none", minWidth: 180, background: "#fff" };
const area = { ...input, width: "100%", minHeight: 72, resize: "vertical" };
const button = (bg = "#f3f4f6", fg = "#111") => ({ padding: "10px 14px", borderRadius: "10px", border: "none", cursor: "pointer", backgroundColor: bg, color: fg, fontWeight: 600, transition: "all .2s" });
const primaryBtn = button("#22c55e", "#fff");
const blueBtn = button("#2563eb", "#fff");
const redBtn = button("#ef4444", "#fff");
const grayBtn = button();

const DishesSection = ({ site, user, goBack }) => {
  const [dishes, setDishes] = useState([]);
  const [stock, setStock] = useState([]);

  const [newDish, setNewDish] = useState({
    name: "",
    description: "",
    ingredients: [], // [{stockItemId, qty, unit}]
  });

  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState(null);

  // Firestore listeners
  useEffect(() => {
    if (!site) return;
    const qDish = query(collection(db, "dishes"), where("site", "==", site));
    const unsub = onSnapshot(qDish, (snap) =>
      setDishes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const qStock = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub = onSnapshot(qStock, (snap) =>
      setStock(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [site]);

  const stockMap = useMemo(() => Object.fromEntries(stock.map(s => [s.id, s])), [stock]);

  // Ingredient helpers
  const addIngredientRow = (setFn) =>
    setFn((p) => ({
      ...p,
      ingredients: [...(p.ingredients || []), { stockItemId: "", qty: "", unit: "unit" }],
    }));

  const updateIngredient = (setFn, idx, key, val) =>
    setFn((p) => {
      const next = [...(p.ingredients || [])];
      next[idx] = { ...next[idx], [key]: val };
      return { ...p, ingredients: next };
    });

  const removeIngredient = (setFn, idx) =>
    setFn((p) => {
      const next = [...(p.ingredients || [])];
      next.splice(idx, 1);
      return { ...p, ingredients: next };
    });

  // CRUD
  const saveNewDish = async () => {
    if (!newDish.name.trim()) return;
    await addDoc(collection(db, "dishes"), {
      name: newDish.name.trim(),
      description: newDish.description.trim(),
      ingredients: (newDish.ingredients || []).filter(i => i.stockItemId),
      site,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });
    setNewDish({ name: "", description: "", ingredients: [] });
  };

  const startEdit = (d) => {
    setEditingId(d.id);
    setEdit({
      name: d.name || "",
      description: d.description || "",
      ingredients: Array.isArray(d.ingredients) ? d.ingredients : [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEdit = async () => {
    if (!edit?.name?.trim()) return;
    const ref = doc(db, "dishes", editingId);
    await updateDoc(ref, {
      name: edit.name.trim(),
      description: edit.description.trim(),
      ingredients: (edit.ingredients || []).filter(i => i.stockItemId),
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    });
    setEditingId(null);
    setEdit(null);
  };

  const delDish = async (id) => {
    if (!window.confirm("Delete this dish?")) return;
    await deleteDoc(doc(db, "dishes", id));
  };

  // UI
  return (
    <div style={wrap}>
      <h2 style={title}>
        Dishes & Recipes — <span style={{ color: "#2563eb" }}>{site}</span>
      </h2>

      {/* Add/Edit card */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
          {editingId ? "Edit Dish" : "Add New Dish"}
        </div>

        <div style={row}>
          <input
            style={{ ...input, minWidth: 260, flex: 1 }}
            placeholder="Dish name (e.g., Mac & Cheese)"
            value={(editingId ? edit : newDish).name}
            onChange={(e) =>
              (editingId ? setEdit : setNewDish)((p) => ({ ...p, name: e.target.value }))
            }
          />
          <input
            style={{ ...input, minWidth: 300, flex: 2 }}
            placeholder="Short description"
            value={(editingId ? edit : newDish).description}
            onChange={(e) =>
              (editingId ? setEdit : setNewDish)((p) => ({ ...p, description: e.target.value }))
            }
          />
        </div>

        <div style={{ marginTop: 10, fontWeight: 600 }}>Ingredients</div>
        <div style={{ ...row, marginTop: 8 }}>
          {(editingId ? edit : newDish).ingredients?.map((ing, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%" }}>
              <select
                style={{ ...input, minWidth: 260, flex: 2 }}
                value={ing.stockItemId}
                onChange={(e) =>
                  updateIngredient(editingId ? setEdit : setNewDish, idx, "stockItemId", e.target.value)
                }
              >
                <option value="">Select stock item…</option>
                {stock.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                style={{ ...input, minWidth: 120 }}
                placeholder="Qty"
                value={ing.qty}
                onChange={(e) =>
                  updateIngredient(editingId ? setEdit : setNewDish, idx, "qty", e.target.value)
                }
              />
              <select
                style={{ ...input, minWidth: 120 }}
                value={ing.unit}
                onChange={(e) =>
                  updateIngredient(editingId ? setEdit : setNewDish, idx, "unit", e.target.value)
                }
              >
                <option value="unit">unit</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="l">l</option>
              </select>
              <button
                onClick={() => removeIngredient(editingId ? setEdit : setNewDish, idx)}
                style={redBtn}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          <button onClick={() => addIngredientRow(editingId ? setEdit : setNewDish)} style={grayBtn}>
            + Add ingredient
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {editingId ? (
            <>
              <button onClick={saveEdit} style={blueBtn}>Save Changes</button>
              <button onClick={() => { setEditingId(null); setEdit(null); }} style={grayBtn}>Cancel</button>
            </>
          ) : (
            <button onClick={saveNewDish} style={primaryBtn}>Add Dish</button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Your Dishes</div>
        {dishes.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No dishes yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {dishes.map((d) => (
              <li
                key={d.id}
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  padding: "12px 0",
                  display: "flex",
                  gap: 12,
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 260, flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{d.name}</div>
                  {d.description && (
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                      {d.description}
                    </div>
                  )}
                  {Array.isArray(d.ingredients) && d.ingredients.length > 0 && (
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
                      Ingredients:{" "}
                      {d.ingredients
                        .map((i) => {
                          const s = stockMap[i.stockItemId];
                          const n = s ? s.name : "(missing)";
                          const qty = i.qty ? ` — ${i.qty}${i.unit || ""}` : "";
                          return `${n}${qty}`;
                        })
                        .join(", ")}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => startEdit(d)} style={grayBtn}>Edit</button>
                  <button onClick={() => delDish(d.id)} style={redBtn}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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

export default DishesSection;