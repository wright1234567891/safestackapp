// src/components/StockSection.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  increment,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import Select from "react-select";
import Tesseract from "tesseract.js";
import {
  FaUpload,
  FaReceipt,
  FaPlus,
  FaCheckCircle,
  FaTimes,
  FaTruckLoading,
  FaUtensils,
  FaBoxOpen,
  FaIndustry,
  FaExclamationTriangle,
} from "react-icons/fa";

const StockSection = ({ site, goBack, user }) => {
  const today = new Date().toISOString().split("T")[0];

  const [stockItems, setStockItems] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [haccpPoints, setHaccpPoints] = useState([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(0);
  const [newMeasurement, setNewMeasurement] = useState("unit");
  const [newLocation, setNewLocation] = useState("Ambient");
  const [newDateReceived, setNewDateReceived] = useState(today);
  const [newUseByDate, setNewUseByDate] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newHACCP, setNewHACCP] = useState([]);

  const [selectedItem, setSelectedItem] = useState(null);
  const [movementType, setMovementType] = useState("delivery");
  const [movementQty, setMovementQty] = useState(0);
  const [movementDateReceived, setMovementDateReceived] = useState(today);
  const [movementUseByDate, setMovementUseByDate] = useState("");

  const [newSupplierName, setNewSupplierName] = useState("");
  const [editBuffer, setEditBuffer] = useState({});
  const [stockSearch, setStockSearch] = useState("");

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrItems, setOcrItems] = useState([]);
  const [ocrImageName, setOcrImageName] = useState("");

  const wrap = {
    maxWidth: "1100px",
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
    padding: "18px",
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

  const fieldWrap = {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  };

  const label = {
    fontSize: "12px",
    fontWeight: 700,
    color: "#374151",
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

  const selectInput = { ...input };

  const button = (bg = "#f3f4f6", fg = "#111") => ({
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    backgroundColor: bg,
    color: fg,
    fontWeight: 600,
  });

  const primaryBtn = button("#22c55e", "#fff");
  const blueBtn = button("#2563eb", "#fff");
  const orangeBtn = button("#f97316", "#fff");
  const redBtn = button("#ef4444", "#fff");
  const grayBtn = button();

  const subtle = { fontSize: "13px", color: "#6b7280" };

  const tableWrap = {
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  };

  const table = {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    fontSize: "14px",
  };

  const th = {
    textAlign: "left",
    padding: "10px 12px",
    background: "#f9fafb",
    position: "sticky",
    top: 0,
    zIndex: 1,
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  };

  const td = {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  };

  const smallInput = {
    ...input,
    padding: "6px 8px",
    borderRadius: "8px",
    minWidth: "90px",
  };

  const smallSelect = { ...smallInput };

  const chip = (bg = "#eef2ff", fg = "#4338ca") => ({
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

  const sectionDivider = {
    margin: "16px 0 10px",
    height: "1px",
    background: "#f1f5f9",
  };

  const selectStyles = {
    control: (provided) => ({
      ...provided,
      minHeight: 42,
      borderRadius: 10,
      borderColor: "#e5e7eb",
      boxShadow: "none",
      ":hover": { borderColor: "#d1d5db" },
      fontSize: 14,
    }),
    menu: (provided) => ({ ...provided, fontSize: 14, color: "#333" }),
    option: (provided, state) => ({
      ...provided,
      color: "#333",
      backgroundColor: state.isFocused ? "#f3f4f6" : "#fff",
    }),
    multiValueLabel: (p) => ({ ...p, color: "#111" }),
    multiValue: (p) => ({ ...p, backgroundColor: "#e5e7eb", borderRadius: 8 }),
  };

  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setStockItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "equipment"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      const eq = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEquipment(
        eq.filter(
          (e) =>
            e.type?.toLowerCase().includes("fridge") ||
            e.type?.toLowerCase().includes("freezer")
        )
      );
    });
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "suppliers"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setSuppliers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "haccpPoints"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setHaccpPoints(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  const filteredHACCP = haccpPoints.map((ccp) => ({
    value: ccp.id,
    label: ccp.name,
  }));

  const filteredStockItems = stockItems.filter((item) => {
    const search = stockSearch.toLowerCase().trim();

    if (!search) return true;

    return (
      item.name?.toLowerCase().includes(search) ||
      item.supplier?.toLowerCase().includes(search) ||
      item.location?.toLowerCase().includes(search) ||
      item.measurement?.toLowerCase().includes(search)
    );
  });

  const resetMovementForm = () => {
    setMovementQty(0);
    setMovementDateReceived(today);
    setMovementUseByDate("");
    setSelectedItem(null);
    setMovementType("delivery");
  };

  const addMovementRecord = async ({
    stockItemId,
    stockItemName,
    type,
    quantity,
    measurement,
    supplier,
    location,
    dateReceived = null,
    useByDate = null,
    price = null,
    source = "manual",
  }) => {
    await addDoc(collection(db, "stockMovements"), {
      stockItemId,
      stockItemName,
      type,
      quantity: Number(quantity),
      measurement: measurement || "unit",
      supplier: supplier || null,
      location: location || null,
      dateReceived: dateReceived || null,
      useByDate: useByDate || null,
      needsUseByReview: type === "delivery" && !useByDate,
      price: price !== null && price !== "" ? Number(price) : null,
      source,
      site,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });
  };

  const addStockItem = async () => {
    if (!newItemName || Number(newItemQty) <= 0 || !newSupplier || !newDateReceived) {
      alert("Please enter item name, quantity, supplier and date received.");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "stockItems"), {
        name: newItemName,
        quantity: Number(newItemQty),
        measurement: newMeasurement,
        location: newLocation,
        dateReceived: newDateReceived,
        lastReceivedDate: newDateReceived,
        useByDate: newUseByDate || null,
        needsUseByReview: !newUseByDate,
        supplier: newSupplier,
        haccpPoints: newHACCP || [],
        site,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      });

      await addMovementRecord({
        stockItemId: docRef.id,
        stockItemName: newItemName,
        type: "delivery",
        quantity: Number(newItemQty),
        measurement: newMeasurement,
        supplier: newSupplier,
        location: newLocation,
        dateReceived: newDateReceived,
        useByDate: newUseByDate || null,
        source: "manual-add",
      });

      setNewItemName("");
      setNewItemQty(0);
      setNewMeasurement("unit");
      setNewLocation("Ambient");
      setNewDateReceived(today);
      setNewUseByDate("");
      setNewSupplier("");
      setNewHACCP([]);
    } catch (error) {
      console.error("Error adding stock item:", error);
      alert("Failed to add stock item.");
    }
  };

  const addSupplier = async () => {
    if (!newSupplierName) return;

    try {
      await addDoc(collection(db, "suppliers"), {
        name: newSupplierName,
        site,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      });
      setNewSupplierName("");
    } catch (error) {
      console.error("Error adding supplier:", error);
      alert("Failed to add supplier.");
    }
  };

  const recordDelivery = async (item, qty, dateReceived, useByDate = null) => {
    if (!item || Number(qty) <= 0) return;

    const ref = doc(db, "stockItems", item.id);

    await updateDoc(ref, {
      quantity: increment(Number(qty)),
      lastReceivedDate: dateReceived || today,
      dateReceived: item.dateReceived || dateReceived || today,
      ...(useByDate ? { useByDate } : {}),
      needsUseByReview: !useByDate,
    });

    await addMovementRecord({
      stockItemId: item.id,
      stockItemName: item.name,
      type: "delivery",
      quantity: Number(qty),
      measurement: item.measurement,
      supplier: item.supplier,
      location: item.location,
      dateReceived: dateReceived || today,
      useByDate: useByDate || null,
      price: item.price ?? null,
      source: "delivery-button",
    });

    resetMovementForm();
  };

  const useStock = async (item, qty) => {
    if (!item || Number(qty) <= 0) return;

    const ref = doc(db, "stockItems", item.id);

    await updateDoc(ref, {
      quantity: increment(-Number(qty)),
    });

    await addMovementRecord({
      stockItemId: item.id,
      stockItemName: item.name,
      type: "usage",
      quantity: Number(qty),
      measurement: item.measurement,
      supplier: item.supplier,
      location: item.location,
      source: "usage-button",
    });

    resetMovementForm();
  };

  const deleteStockItem = async (itemId) => {
    const confirmed = window.confirm("Delete this stock item?");
    if (!confirmed) return;
    await deleteDoc(doc(db, "stockItems", itemId));
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      Object.entries(editBuffer).forEach(([id, fields]) => {
        Object.entries(fields).forEach(([field, value]) => {
          const ref = doc(db, "stockItems", id);

          const updateData = { [field]: value };

          if (field === "useByDate") {
            updateData.needsUseByReview = !value;
          }

          updateDoc(ref, updateData).catch(console.error);
        });
      });
      setEditBuffer({});
    }, 500);

    return () => clearTimeout(timeout);
  }, [editBuffer]);

  const handleEdit = (itemId, field, value) => {
    setEditBuffer((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const gramsToKg = (gNum) => {
    if (!gNum && gNum !== 0) return null;
    return Number(gNum) / 1000;
  };

  const parseMoney = (str) => {
    if (!str) return null;
    const m = String(str).match(/(\d+(?:[\.,]\d{2})?)/);
    if (!m) return null;
    return Number(m[1].replace(",", "."));
  };

  const parseWeightToQtyAndMeasurement = (weightStr) => {
    if (!weightStr) return { qty: 1, measurement: "unit", rawWeight: "" };

    const s = weightStr.toLowerCase().replace(/\s/g, "");
    const m = s.match(/(\d+(?:[\.,]\d+)?)(kg|g|l|ml)/i);

    if (!m) return { qty: 1, measurement: "unit", rawWeight: weightStr };

    const num = Number(m[1].replace(",", "."));
    const unit = m[2];

    if (unit === "kg") return { qty: num, measurement: "kg", rawWeight: weightStr };
    if (unit === "g") return { qty: gramsToKg(num), measurement: "kg", rawWeight: weightStr };
    if (unit === "l") return { qty: num, measurement: "unit", rawWeight: weightStr };
    if (unit === "ml") return { qty: num / 1000, measurement: "unit", rawWeight: weightStr };

    return { qty: 1, measurement: "unit", rawWeight: weightStr };
  };

  const parseReceiptText = (text) => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/total|subtotal|vat|change|card|cash|balance/i.test(l));

    const items = [];

    for (const line of lines) {
      const priceMatch =
        line.match(/£\s*\d+(?:[\.,]\d{2})?|\d+(?:[\.,]\d{2})\s*£/i) ||
        line.match(/\b\d+(?:[\.,]\d{2})\b/);

      const weightMatch = line.match(/(\d+(?:[\.,]\d+)?)(kg|g|ml|l)\b/i);

      let name = line;

      if (priceMatch) name = name.replace(priceMatch[0], "");
      if (weightMatch) name = name.replace(weightMatch[0], "");

      name = name.replace(/\s{2,}/g, " ").trim();

      if (!name || name.length < 2) continue;

      const price = priceMatch ? parseMoney(priceMatch[0]) : null;
      const weightStr = weightMatch ? weightMatch[0] : "";
      const { qty, measurement, rawWeight } = parseWeightToQtyAndMeasurement(weightStr);

      items.push({
        id: `${line}-${Math.random().toString(36).slice(2, 7)}`,
        selected: true,
        name,
        quantity: qty || 1,
        measurement: measurement || "unit",
        price,
        rawWeight,
        location: "Ambient",
        dateReceived: today,
        useByDate: "",
        supplier: newSupplier || "",
      });
    }

    return items;
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrImageName(file.name);
    setOcrLoading(true);
    setOcrError("");

    try {
      const {
        data: { text },
      } = await Tesseract.recognize(file, "eng");

      const parsed = parseReceiptText(text);

      if (!parsed.length) {
        setOcrItems([]);
        setOcrError("No items could be parsed from this image. Try a clearer, well-lit photo.");
      } else {
        setOcrItems(parsed);
      }
    } catch (err) {
      console.error("OCR error:", err);
      setOcrError("Failed to process receipt image.");
      setOcrItems([]);
    } finally {
      setOcrLoading(false);
      e.target.value = "";
    }
  };

  const updateOcrItem = (id, field, value) => {
    setOcrItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const addSelectedOcrItems = async () => {
    const selected = ocrItems.filter((i) => i.selected && i.name);

    if (!selected.length) {
      alert("Nothing selected to add.");
      return;
    }

    try {
      for (const it of selected) {
        const docRef = await addDoc(collection(db, "stockItems"), {
          name: it.name,
          quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
          measurement: it.measurement || "unit",
          location: it.location || "Ambient",
          dateReceived: it.dateReceived || today,
          lastReceivedDate: it.dateReceived || today,
          useByDate: it.useByDate || null,
          needsUseByReview: !it.useByDate,
          supplier: it.supplier || newSupplier || "Unknown",
          haccpPoints: [],
          site,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
          ...(it.price != null ? { price: Number(it.price) } : {}),
          ...(it.rawWeight ? { parsedWeight: it.rawWeight } : {}),
          source: ocrImageName || "ocr",
        });

        await addMovementRecord({
          stockItemId: docRef.id,
          stockItemName: it.name,
          type: "delivery",
          quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
          measurement: it.measurement || "unit",
          supplier: it.supplier || newSupplier || "Unknown",
          location: it.location || "Ambient",
          dateReceived: it.dateReceived || today,
          useByDate: it.useByDate || null,
          price: it.price ?? null,
          source: ocrImageName || "ocr",
        });
      }

      alert(`${selected.length} item(s) added from receipt.`);
      setOcrItems([]);
      setOcrImageName("");
      setOcrError("");
    } catch (err) {
      console.error("Error adding OCR items:", err);
      alert("Failed to save one or more items.");
    }
  };

  return (
    <div style={wrap}>
      <h2 style={title}>
        Stock Management — <span style={{ color: "#2563eb" }}>{site}</span>
      </h2>

      <div style={card}>
        <div style={sectionHeader}>
          <FaReceipt color="#111827" />
          Add from receipt photo
        </div>

        <div style={{ ...row, alignItems: "center" }}>
          <label
            htmlFor="receiptUpload"
            style={{
              ...button("#f3f4f6", "#111"),
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FaUpload />
            Upload photo
          </label>

          <input
            id="receiptUpload"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoUpload}
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ ...chip("#ecfeff", "#0891b2") }}>
              <FaIndustry />
              Supplier
            </span>

            <select
              value={newSupplier}
              onChange={(e) => setNewSupplier(e.target.value)}
              style={selectInput}
              title="Supplier for OCR-added items"
            >
              <option value="">Select supplier optional</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.name}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {ocrLoading && (
          <div style={{ marginTop: 10, ...subtle }}>
            Reading receipt… this can take a moment.
          </div>
        )}

        {ocrError && (
          <div style={{ marginTop: 10, color: "#dc2626", fontSize: 13 }}>
            {ocrError}
          </div>
        )}

        {ocrItems.length > 0 && (
          <>
            <div style={sectionDivider} />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 600 }}>
                Parsed items from{" "}
                <span style={{ fontStyle: "italic", color: "#6b7280" }}>
                  {ocrImageName || "image"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() =>
                    setOcrItems((prev) => prev.map((i) => ({ ...i, selected: true })))
                  }
                  style={grayBtn}
                >
                  Select all
                </button>

                <button
                  onClick={() =>
                    setOcrItems((prev) => prev.map((i) => ({ ...i, selected: false })))
                  }
                  style={grayBtn}
                >
                  Deselect all
                </button>

                <button
                  onClick={() => {
                    setOcrItems([]);
                    setOcrError("");
                    setOcrImageName("");
                  }}
                  style={grayBtn}
                >
                  Clear
                </button>
              </div>
            </div>

            <div style={tableWrap}>
              <div style={{ overflowX: "auto", maxHeight: 420 }}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Add</th>
                      <th style={th}>Name</th>
                      <th style={th}>Qty</th>
                      <th style={th}>Meas.</th>
                      <th style={th}>Supplier</th>
                      <th style={th}>Location</th>
                      <th style={th}>Date received</th>
                      <th style={th}>Use-by date</th>
                      <th style={th}>Price</th>
                      <th style={th}>Parsed weight</th>
                    </tr>
                  </thead>

                  <tbody>
                    {ocrItems.map((it, idx) => (
                      <tr
                        key={it.id}
                        style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}
                      >
                        <td style={td}>
                          <input
                            type="checkbox"
                            checked={!!it.selected}
                            onChange={(e) =>
                              updateOcrItem(it.id, "selected", e.target.checked)
                            }
                          />
                        </td>

                        <td style={td}>
                          <input
                            type="text"
                            value={it.name}
                            onChange={(e) => updateOcrItem(it.id, "name", e.target.value)}
                            style={{ ...smallInput, minWidth: 200 }}
                          />
                        </td>

                        <td style={td}>
                          <input
                            type="number"
                            step="0.01"
                            value={it.quantity}
                            onChange={(e) =>
                              updateOcrItem(it.id, "quantity", Number(e.target.value))
                            }
                            style={smallInput}
                          />
                        </td>

                        <td style={td}>
                          <select
                            value={it.measurement}
                            onChange={(e) =>
                              updateOcrItem(it.id, "measurement", e.target.value)
                            }
                            style={smallSelect}
                          >
                            <option value="unit">Units</option>
                            <option value="kg">Kilograms</option>
                          </select>
                        </td>

                        <td style={td}>
                          <select
                            value={it.supplier || ""}
                            onChange={(e) =>
                              updateOcrItem(it.id, "supplier", e.target.value)
                            }
                            style={{ ...smallSelect, minWidth: 160 }}
                          >
                            <option value="">None</option>
                            {suppliers.map((sup) => (
                              <option key={sup.id} value={sup.name}>
                                {sup.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td style={td}>
                          <select
                            value={it.location}
                            onChange={(e) =>
                              updateOcrItem(it.id, "location", e.target.value)
                            }
                            style={{ ...smallSelect, minWidth: 170 }}
                          >
                            <option value="Ambient">Ambient</option>
                            {equipment.map((eq) => (
                              <option key={eq.id} value={eq.name || eq.id}>
                                {eq.name || eq.type}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td style={td}>
                          <input
                            type="date"
                            value={it.dateReceived || today}
                            onChange={(e) =>
                              updateOcrItem(it.id, "dateReceived", e.target.value)
                            }
                            style={smallInput}
                          />
                        </td>

                        <td style={td}>
                          <input
                            type="date"
                            value={it.useByDate || ""}
                            onChange={(e) =>
                              updateOcrItem(it.id, "useByDate", e.target.value)
                            }
                            style={smallInput}
                          />
                        </td>

                        <td style={td}>
                          <input
                            type="number"
                            step="0.01"
                            value={it.price ?? ""}
                            onChange={(e) =>
                              updateOcrItem(
                                it.id,
                                "price",
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                            placeholder="0.00"
                            style={smallInput}
                          />
                        </td>

                        <td style={{ ...td, color: "#6b7280" }}>
                          {it.rawWeight || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={addSelectedOcrItems} style={primaryBtn}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <FaCheckCircle />
                  Add selected items
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <div style={sectionHeader}>
          <FaBoxOpen color="#0ea5e9" />
          Add stock item manually
        </div>

        <div style={row}>
          <div style={{ ...fieldWrap, flex: 1, minWidth: 220 }}>
            <label style={label}>Item name</label>
            <input
              type="text"
              placeholder="e.g. Whole Milk"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              style={{ ...input, minWidth: "100%" }}
            />
          </div>

          <div style={fieldWrap}>
            <label style={label}>Quantity</label>
            <input
              type="number"
              placeholder="Qty"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              style={input}
            />
          </div>

          <div style={fieldWrap}>
            <label style={label}>Measurement</label>
            <select
              value={newMeasurement}
              onChange={(e) => setNewMeasurement(e.target.value)}
              style={selectInput}
            >
              <option value="unit">Units</option>
              <option value="kg">Kilograms</option>
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={label}>Location</label>
            <select
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              style={{ ...selectInput, minWidth: 200 }}
            >
              <option value="Ambient">Ambient</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.name || eq.id}>
                  {eq.name || eq.type}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={label}>Date received</label>
            <input
              type="date"
              value={newDateReceived}
              onChange={(e) => setNewDateReceived(e.target.value)}
              style={input}
            />
          </div>

          <div style={fieldWrap}>
            <label style={label}>Use-by date if shown</label>
            <input
              type="date"
              value={newUseByDate}
              onChange={(e) => setNewUseByDate(e.target.value)}
              style={input}
            />
          </div>

          <div style={fieldWrap}>
            <label style={label}>Supplier</label>
            <select
              value={newSupplier}
              onChange={(e) => setNewSupplier(e.target.value)}
              style={{ ...selectInput, minWidth: 220 }}
            >
              <option value="">Select supplier</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.name}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ ...fieldWrap, flex: 1, minWidth: 240 }}>
            <label style={label}>HACCP points</label>
            <Select
              styles={selectStyles}
              isMulti
              options={filteredHACCP}
              value={filteredHACCP.filter((ccp) => newHACCP.includes(ccp.value))}
              onChange={(selected) =>
                setNewHACCP(selected ? selected.map((s) => s.value) : [])
              }
              placeholder="HACCP points"
            />
          </div>
        </div>

        {!newUseByDate && (
          <div style={{ marginTop: 10, color: "#92400e", fontSize: 13 }}>
            <FaExclamationTriangle /> No use-by date entered. This will be flagged for
            management review.
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={addStockItem} style={primaryBtn}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <FaPlus />
              Add Item
            </span>
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={sectionHeader}>
          <FaBoxOpen color="#4f46e5" />
          Current stock
        </div>

        <input
          type="text"
          placeholder="Search stock by item, supplier, location or measurement..."
          value={stockSearch}
          onChange={(e) => setStockSearch(e.target.value)}
          style={{
            ...input,
            width: "100%",
            marginBottom: "10px",
            boxSizing: "border-box",
          }}
        />

        <div style={{ ...subtle, marginBottom: "10px" }}>
          Showing {filteredStockItems.length} of {stockItems.length} stock items
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filteredStockItems.map((item) => {
            const currentHaccpIds =
              editBuffer[item.id]?.haccpPoints ?? item.haccpPoints ?? [];

            const currentHaccpOptions = filteredHACCP.filter((opt) =>
              currentHaccpIds.includes(opt.value)
            );

            const useByValue =
              editBuffer[item.id]?.useByDate ??
              item.useByDate ??
              item.expiryDate ??
              "";

            const dateReceivedValue =
              editBuffer[item.id]?.dateReceived ?? item.dateReceived ?? "";

            return (
              <li
                key={item.id}
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #f1f5f9",
                  padding: "12px 0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  <input
                    type="text"
                    value={editBuffer[item.id]?.name ?? item.name}
                    onChange={(e) => handleEdit(item.id, "name", e.target.value)}
                    style={{ ...smallInput, minWidth: 180 }}
                  />

                  <input
                    type="number"
                    value={editBuffer[item.id]?.quantity ?? item.quantity}
                    onChange={(e) =>
                      handleEdit(item.id, "quantity", Number(e.target.value))
                    }
                    style={{ ...smallInput, minWidth: 90 }}
                  />

                  <select
                    value={editBuffer[item.id]?.measurement ?? item.measurement}
                    onChange={(e) => handleEdit(item.id, "measurement", e.target.value)}
                    style={smallSelect}
                  >
                    <option value="unit">Units</option>
                    <option value="kg">Kilograms</option>
                  </select>

                  <select
                    value={editBuffer[item.id]?.location ?? item.location}
                    onChange={(e) => handleEdit(item.id, "location", e.target.value)}
                    style={{ ...smallSelect, minWidth: 160 }}
                  >
                    <option value="Ambient">Ambient</option>
                    {equipment.map((eq) => (
                      <option key={eq.id} value={eq.name || eq.id}>
                        {eq.name || eq.type}
                      </option>
                    ))}
                  </select>

                  <div style={fieldWrap}>
                    <label style={label}>Date received</label>
                    <input
                      type="date"
                      value={dateReceivedValue}
                      onChange={(e) =>
                        handleEdit(item.id, "dateReceived", e.target.value)
                      }
                      style={smallInput}
                    />
                  </div>

                  <div style={fieldWrap}>
                    <label style={label}>Use-by</label>
                    <input
                      type="date"
                      value={useByValue}
                      onChange={(e) => handleEdit(item.id, "useByDate", e.target.value)}
                      style={smallInput}
                    />
                  </div>

                  <select
                    value={(editBuffer[item.id]?.supplier ?? item.supplier) || ""}
                    onChange={(e) => handleEdit(item.id, "supplier", e.target.value)}
                    style={{ ...smallSelect, minWidth: 180 }}
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.name}>
                        {sup.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="0.01"
                    value={(editBuffer[item.id]?.price ?? item.price) ?? ""}
                    onChange={(e) =>
                      handleEdit(
                        item.id,
                        "price",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    placeholder="£"
                    title="Item price optional"
                    style={{ ...smallInput, minWidth: 110 }}
                  />

                  <div style={{ minWidth: 240, flex: 1 }}>
                    <Select
                      styles={selectStyles}
                      isMulti
                      options={filteredHACCP}
                      value={currentHaccpOptions}
                      onChange={(selected) =>
                        handleEdit(
                          item.id,
                          "haccpPoints",
                          selected ? selected.map((s) => s.value) : []
                        )
                      }
                      placeholder="HACCP points"
                    />
                  </div>

                  {(item.needsUseByReview || !useByValue) && (
                    <span style={chip("#fef3c7", "#92400e")}>
                      <FaExclamationTriangle />
                      Review use-by
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setMovementType("delivery");
                      setMovementDateReceived(today);
                      setMovementUseByDate(item.useByDate || item.expiryDate || "");
                    }}
                    style={blueBtn}
                    title="Record delivery increase qty"
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <FaTruckLoading />
                      Delivery
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setMovementType("usage");
                    }}
                    style={orangeBtn}
                    title="Use stock decrease qty"
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <FaUtensils />
                      Use
                    </span>
                  </button>

                  <button
                    onClick={() => deleteStockItem(item.id)}
                    style={redBtn}
                    title="Delete item"
                  >
                    <FaTimes />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {selectedItem && (
        <div style={card}>
          <div style={sectionHeader}>
            <FaBoxOpen color="#16a34a" />
            {movementType === "delivery" ? "Record delivery" : "Use stock"} —{" "}
            <span style={{ color: "#16a34a" }}>{selectedItem.name}</span>
          </div>

          <div style={{ ...row, alignItems: "flex-end" }}>
            <div style={fieldWrap}>
              <label style={label}>Quantity</label>
              <input
                type="number"
                step={selectedItem.measurement === "kg" ? "0.1" : "1"}
                value={movementQty}
                onChange={(e) => setMovementQty(Number(e.target.value))}
                style={{ ...input, minWidth: 140 }}
              />
            </div>

            {movementType === "delivery" && (
              <>
                <div style={fieldWrap}>
                  <label style={label}>Date received</label>
                  <input
                    type="date"
                    value={movementDateReceived}
                    onChange={(e) => setMovementDateReceived(e.target.value)}
                    style={input}
                  />
                </div>

                <div style={fieldWrap}>
                  <label style={label}>Use-by date if shown</label>
                  <input
                    type="date"
                    value={movementUseByDate}
                    onChange={(e) => setMovementUseByDate(e.target.value)}
                    style={input}
                  />
                </div>
              </>
            )}

            {movementType === "delivery" ? (
              <button
                onClick={() =>
                  recordDelivery(
                    selectedItem,
                    movementQty,
                    movementDateReceived,
                    movementUseByDate
                  )
                }
                style={blueBtn}
              >
                + Confirm delivery
              </button>
            ) : (
              <button onClick={() => useStock(selectedItem, movementQty)} style={orangeBtn}>
                - Confirm usage
              </button>
            )}

            <button onClick={resetMovementForm} style={grayBtn}>
              Cancel
            </button>
          </div>

          {movementType === "delivery" && !movementUseByDate && (
            <div style={{ marginTop: 10, color: "#92400e", fontSize: 13 }}>
              <FaExclamationTriangle /> No use-by date entered. This delivery will be
              flagged for review.
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div style={sectionHeader}>
          <FaIndustry color="#0891b2" />
          Add Supplier
        </div>

        <div style={row}>
          <input
            type="text"
            placeholder="Supplier name"
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
            style={{ ...input, flex: 1, minWidth: 260 }}
          />

          <button onClick={addSupplier} style={primaryBtn}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <FaPlus />
              Add
            </span>
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <button onClick={goBack} style={grayBtn}>
          Back
        </button>
      </div>
    </div>
  );
};

export default StockSection;