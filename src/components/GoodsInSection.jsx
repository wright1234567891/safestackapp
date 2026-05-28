// src/components/GoodsInSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  increment,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import {
  FaPlus,
  FaTruckLoading,
  FaIndustry,
  FaBoxOpen,
  FaExclamationTriangle,
  FaTrashAlt,
  FaCheckCircle,
} from "react-icons/fa";

const GoodsInSection = ({ site, goBack, user }) => {
  const today = new Date().toISOString().split("T")[0];

  const [stockItems, setStockItems] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [supplier, setSupplier] = useState("");
  const [deliveryRef, setDeliveryRef] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");

  const [lines, setLines] = useState([
    {
      id: crypto.randomUUID(),
      mode: "existing",
      stockItemId: "",
      name: "",
      quantity: "",
      measurement: "unit",
      location: "Ambient",
      useByDate: "",
      price: "",
    },
  ]);

  const wrap = {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "'Inter', sans-serif",
    color: "#111",
  };

  const title = {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 22,
    textAlign: "center",
  };

  const card = {
    background: "#fff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    marginBottom: 18,
  };

  const sectionHeader = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 700,
    fontSize: 16,
    marginBottom: 14,
  };

  const row = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  };

  const fieldWrap = {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  };

  const label = {
    fontSize: 12,
    fontWeight: 700,
    color: "#374151",
  };

  const input = {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
    minWidth: 180,
    background: "#fff",
  };

  const smallInput = {
    ...input,
    padding: "8px 10px",
    borderRadius: 8,
    minWidth: 100,
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

  const primaryBtn = button("#22c55e", "#fff");
  const blueBtn = button("#2563eb", "#fff");
  const redBtn = button("#ef4444", "#fff");
  const grayBtn = button();

  const subtle = { fontSize: 13, color: "#6b7280" };

  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setStockItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "equipment"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEquipment(
        rows.filter(
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
      setSuppliers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [site]);

  const stockMap = useMemo(
    () => Object.fromEntries(stockItems.map((item) => [item.id, item])),
    [stockItems]
  );

  const normaliseStockName = (name) =>
    (name || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

  const findExistingStockItem = (name) => {
    const target = normaliseStockName(name);
    return stockItems.find((item) => normaliseStockName(item.name) === target);
  };

  const updateLine = (lineId, field, value) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;

        const next = { ...line, [field]: value };

        if (field === "stockItemId") {
          const item = stockMap[value];
          if (item) {
            next.name = item.name || "";
            next.measurement = item.measurement || "unit";
            next.location = item.location || "Ambient";
            next.price = item.price ?? "";
          }
        }

        if (field === "mode") {
          next.stockItemId = "";
          next.name = "";
          next.quantity = "";
          next.measurement = "unit";
          next.location = "Ambient";
          next.useByDate = "";
          next.price = "";
        }

        return next;
      })
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        mode: "existing",
        stockItemId: "",
        name: "",
        quantity: "",
        measurement: "unit",
        location: "Ambient",
        useByDate: "",
        price: "",
      },
    ]);
  };

  const removeLine = (lineId) => {
    setLines((prev) => prev.filter((line) => line.id !== lineId));
  };

  const createStockBatch = async ({
    deliveryId,
    stockItemId,
    stockItemName,
    quantity,
    measurement,
    supplier,
    location,
    dateReceived,
    useByDate,
    price,
  }) => {
    return addDoc(collection(db, "stockBatches"), {
      deliveryId,
      stockItemId,
      stockItemName,
      quantityReceived: Number(quantity),
      quantityRemaining: Number(quantity),
      measurement: measurement || "unit",
      supplier: supplier || null,
      location: location || null,
      dateReceived: dateReceived || today,
      useByDate: useByDate || null,
      needsUseByReview: !useByDate,
      price: price !== "" && price !== null && price !== undefined ? Number(price) : null,
      source: "goods-in",
      site,
      status: "active",
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });
  };

  const addMovementRecord = async ({
    deliveryId,
    stockItemId,
    stockItemName,
    quantity,
    measurement,
    supplier,
    location,
    dateReceived,
    useByDate,
    price,
  }) => {
    return addDoc(collection(db, "stockMovements"), {
      deliveryId,
      stockItemId,
      stockItemName,
      type: "delivery",
      quantity: Number(quantity),
      measurement: measurement || "unit",
      supplier: supplier || null,
      location: location || null,
      dateReceived: dateReceived || null,
      useByDate: useByDate || null,
      needsUseByReview: !useByDate,
      price: price !== "" && price !== null && price !== undefined ? Number(price) : null,
      source: "goods-in",
      site,
      createdAt: serverTimestamp(),
      createdBy: user?.name || user?.displayName || user?.email || "Unknown",
      createdByUid: user?.uid || user?.id || null,
    });
  };

  const addSupplier = async () => {

  const cleanName = newSupplierName.trim();

  if (!cleanName) {

    alert("Enter a supplier name.");

    return;

  }

  const exists = suppliers.some(

    (sup) => sup.name?.toLowerCase().trim() === cleanName.toLowerCase()

  );

  if (exists) {

    alert("Supplier already exists.");

    setSupplier(cleanName);

    setNewSupplierName("");

    return;

  }

  try {

    await addDoc(collection(db, "suppliers"), {

      name: cleanName,

      site,

      createdAt: serverTimestamp(),

      createdBy: user?.uid || null,

    });

    setSupplier(cleanName);

    setNewSupplierName("");

  } catch (error) {

    console.error("Error adding supplier:", error);

    alert("Failed to add supplier.");

  }

};

  const saveGoodsIn = async () => {
    if (!supplier || !deliveryDate) {
      alert("Please choose supplier and delivery date.");
      return;
    }

    const validLines = lines.filter((line) => {
      const qtyOk = Number(line.quantity) > 0;
      const hasItem = line.mode === "existing" ? !!line.stockItemId : !!line.name?.trim();
      return qtyOk && hasItem;
    });

    if (!validLines.length) {
      alert("Please add at least one valid delivery line.");
      return;
    }

    try {
      const deliveryDoc = await addDoc(collection(db, "goodsIn"), {
        site,
        supplier,
        deliveryRef: deliveryRef || null,
        deliveryDate,
        notes: notes || null,
        lineCount: validLines.length,
        status: "posted-to-stock",
        createdAt: serverTimestamp(),
        createdBy: user?.name || user?.displayName || user?.email || "Unknown",
        createdByUid: user?.uid || user?.id || null,
      });

      for (const line of validLines) {
        const qtyToAdd = Number(line.quantity);
        let stockItemId = line.stockItemId;
        let stockItemName = line.name?.trim();

        const existing =
          line.mode === "existing"
            ? stockMap[line.stockItemId]
            : findExistingStockItem(line.name);

        const measurementToUse = existing?.measurement || line.measurement || "unit";
        const locationToUse = existing?.location || line.location || "Ambient";

        if (existing) {
          stockItemId = existing.id;
          stockItemName = existing.name;

          await updateDoc(doc(db, "stockItems", existing.id), {
            quantity: increment(qtyToAdd),
            supplier: existing.supplier || supplier,
            lastReceivedDate: deliveryDate,
            updatedAt: serverTimestamp(),
          });
        } else {
          const itemDoc = await addDoc(collection(db, "stockItems"), {
            name: stockItemName,
            quantity: qtyToAdd,
            measurement: measurementToUse,
            location: locationToUse,
            supplier,
            haccpPoints: [],
            site,
            source: "goods-in",
            createdAt: serverTimestamp(),
            createdBy: user?.uid || null,
            ...(line.price !== "" ? { price: Number(line.price) } : {}),
          });

          stockItemId = itemDoc.id;
        }

        await addDoc(collection(db, "goodsInLines"), {
          deliveryId: deliveryDoc.id,
          site,
          supplier,
          deliveryDate,
          stockItemId,
          stockItemName,
          quantity: qtyToAdd,
          measurement: measurementToUse,
          location: locationToUse,
          useByDate: line.useByDate || null,
          needsUseByReview: !line.useByDate,
          price: line.price !== "" ? Number(line.price) : null,
          createdAt: serverTimestamp(),
        });

        await createStockBatch({
          deliveryId: deliveryDoc.id,
          stockItemId,
          stockItemName,
          quantity: qtyToAdd,
          measurement: measurementToUse,
          supplier,
          location: locationToUse,
          dateReceived: deliveryDate,
          useByDate: line.useByDate || null,
          price: line.price,
        });

        await addMovementRecord({
          deliveryId: deliveryDoc.id,
          stockItemId,
          stockItemName,
          quantity: qtyToAdd,
          measurement: measurementToUse,
          supplier,
          location: locationToUse,
          dateReceived: deliveryDate,
          useByDate: line.useByDate || null,
          price: line.price,
        });
      }

      alert("Goods in saved and stock updated.");

      setSupplier("");
      setDeliveryRef("");
      setDeliveryDate(today);
      setNotes("");
      setLines([
        {
          id: crypto.randomUUID(),
          mode: "existing",
          stockItemId: "",
          name: "",
          quantity: "",
          measurement: "unit",
          location: "Ambient",
          useByDate: "",
          price: "",
        },
      ]);
    } catch (error) {
      console.error("Error saving goods in:", error);
      alert("Failed to save goods in.");
    }
  };

  return (
    <div style={wrap}>
      <h2 style={title}>
        Goods In — <span style={{ color: "#2563eb" }}>{site}</span>
      </h2>

      <div style={card}>
        <div style={sectionHeader}>
          <FaTruckLoading color="#2563eb" />
          Delivery details
        </div>

        <div style={row}>
          <div style={{ ...fieldWrap, minWidth: 240 }}>
            <label style={label}>Supplier</label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              style={{ ...input, minWidth: 240 }}
            >
              <option value="">Select supplier</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.name}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={label}>Delivery date</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              style={input}
            />
          </div>

          <div style={{ ...fieldWrap, flex: 1, minWidth: 220 }}>
            <label style={label}>Delivery note / invoice ref optional</label>
            <input
              type="text"
              value={deliveryRef}
              onChange={(e) => setDeliveryRef(e.target.value)}
              placeholder="e.g. Brakes invoice 12345"
              style={{ ...input, minWidth: "100%" }}
            />
          </div>
        </div>

        <div style={{ ...fieldWrap, marginTop: 10 }}>
          <label style={label}>Notes optional</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any delivery issues, substitutions, damaged items, etc."
            style={{ ...input, width: "100%", minHeight: 70, resize: "vertical", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <div style={card}>

  <div style={sectionHeader}>

    <FaIndustry color="#0891b2" />

    Add new supplier

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

      <FaPlus />

      Add supplier

    </button>

  </div>

</div>

      <div style={card}>
        <div style={sectionHeader}>
          <FaBoxOpen color="#16a34a" />
          Delivery lines
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {lines.map((line, index) => (
            <div
              key={line.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
                background: "#f9fafb",
              }}
            >
              <div style={{ ...row, alignItems: "flex-end" }}>
                <div style={fieldWrap}>
                  <label style={label}>Line type</label>
                  <select
                    value={line.mode}
                    onChange={(e) => updateLine(line.id, "mode", e.target.value)}
                    style={smallInput}
                  >
                    <option value="existing">Existing item</option>
                    <option value="new">New item</option>
                  </select>
                </div>

                {line.mode === "existing" ? (
                  <div style={{ ...fieldWrap, flex: 1, minWidth: 240 }}>
                    <label style={label}>Stock item</label>
                    <select
                      value={line.stockItemId}
                      onChange={(e) => updateLine(line.id, "stockItemId", e.target.value)}
                      style={{ ...smallInput, minWidth: "100%" }}
                    >
                      <option value="">Select item</option>
                      {stockItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ ...fieldWrap, flex: 1, minWidth: 240 }}>
                    <label style={label}>New item name</label>
                    <input
                      type="text"
                      value={line.name}
                      onChange={(e) => updateLine(line.id, "name", e.target.value)}
                      placeholder="e.g. White flour bap"
                      style={{ ...smallInput, minWidth: "100%" }}
                    />
                  </div>
                )}

                <div style={fieldWrap}>
                  <label style={label}>Qty</label>
                  <input
                    type="number"
                    step={line.measurement === "kg" ? "0.1" : "1"}
                    value={line.quantity}
                    onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                    style={smallInput}
                  />
                </div>

                <div style={fieldWrap}>
                  <label style={label}>Measurement</label>
                  <select
                    value={line.measurement}
                    onChange={(e) => updateLine(line.id, "measurement", e.target.value)}
                    style={smallInput}
                    disabled={line.mode === "existing" && !!line.stockItemId}
                  >
                    <option value="unit">Units</option>
                    <option value="slice">Slices</option>
                    <option value="portion">Portions</option>
                    <option value="kg">Kilograms</option>
                  </select>
                </div>

                <div style={fieldWrap}>
                  <label style={label}>Location</label>
                  <select
                    value={line.location}
                    onChange={(e) => updateLine(line.id, "location", e.target.value)}
                    style={{ ...smallInput, minWidth: 160 }}
                    disabled={line.mode === "existing" && !!line.stockItemId}
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
                  <label style={label}>Use-by date if shown</label>
                  <input
                    type="date"
                    value={line.useByDate}
                    onChange={(e) => updateLine(line.id, "useByDate", e.target.value)}
                    style={{
                      ...smallInput,
                      borderColor: line.useByDate ? "#e5e7eb" : "#f59e0b",
                      background: line.useByDate ? "#fff" : "#fffbeb",
                    }}
                  />
                </div>

                <div style={fieldWrap}>
                  <label style={label}>Price optional</label>
                  <input
                    type="number"
                    step="0.01"
                    value={line.price}
                    onChange={(e) => updateLine(line.id, "price", e.target.value)}
                    placeholder="£"
                    style={smallInput}
                  />
                </div>

                <button
                  onClick={() => removeLine(line.id)}
                  style={redBtn}
                  disabled={lines.length === 1}
                  title="Remove line"
                >
                  <FaTrashAlt />
                </button>
              </div>

              {!line.useByDate && (
                <div style={{ marginTop: 8, color: "#92400e", fontSize: 13 }}>
                  <FaExclamationTriangle /> No use-by date entered. This batch will be flagged for review.
                </div>
              )}

              <div style={{ marginTop: 6, ...subtle }}>Line {index + 1}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <button onClick={addLine} style={grayBtn}>
            <FaPlus />
            Add another line
          </button>

          <button onClick={saveGoodsIn} style={primaryBtn}>
            <FaCheckCircle />
            Save goods in & update stock
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={sectionHeader}>
          <FaIndustry color="#0891b2" />
          How this links to stock
        </div>

        <div style={subtle}>
          Saving goods in creates a goodsIn record, goodsInLines records, stockBatches records,
          stockMovements records, and updates stockItems quantity. Missing use-by dates are still
          flagged for dashboard review.
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

export default GoodsInSection;
