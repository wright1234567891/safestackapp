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
import Tesseract from "tesseract.js"; // 👈 OCR

const StockSection = ({ site, goBack, user }) => {
  const [stockItems, setStockItems] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [haccpPoints, setHaccpPoints] = useState([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(0);
  const [newMeasurement, setNewMeasurement] = useState("unit");
  const [newLocation, setNewLocation] = useState("Ambient");
  const [newExpiry, setNewExpiry] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newHACCP, setNewHACCP] = useState([]);

  const [selectedItem, setSelectedItem] = useState(null);
  const [movementQty, setMovementQty] = useState(0);
  const [newSupplierName, setNewSupplierName] = useState("");

  const [editBuffer, setEditBuffer] = useState({});

  // --- OCR states (added) ---
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrItems, setOcrItems] = useState([]); // [{id, selected, name, qty, measurement, price, rawWeight}]
  const [ocrImageName, setOcrImageName] = useState("");

  const selectStyles = {
    control: (provided) => ({ ...provided, minHeight: "40px", fontSize: "14px" }),
    menu: (provided) => ({ ...provided, fontSize: "14px", color: "#333" }),
    option: (provided, state) => ({
      ...provided,
      color: "#333",
      backgroundColor: state.isFocused ? "#e2e8f0" : "#fff",
    }),
    multiValueLabel: (provided) => ({ ...provided, color: "#fff" }),
    multiValue: (provided) => ({ ...provided, backgroundColor: "#4ade80" }),
  };

  // --- Fetch Firestore collections ---
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

  // --- Add / Update / Delete functions ---
  const addStockItem = async () => {
    if (!newItemName || newItemQty <= 0 || !newSupplier) {
      alert("Please fill in all required fields");
      return;
    }
    try {
      await addDoc(collection(db, "stockItems"), {
        name: newItemName,
        quantity: Number(newItemQty),
        measurement: newMeasurement,
        location: newLocation,
        expiryDate: newExpiry || null,
        supplier: newSupplier,
        haccpPoints: newHACCP || [],
        site,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      });
      setNewItemName("");
      setNewItemQty(0);
      setNewMeasurement("unit");
      setNewLocation("Ambient");
      setNewExpiry("");
      setNewSupplier("");
      setNewHACCP([]);
    } catch (error) {
      console.error("Error adding stock item:", error);
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
    }
  };

  const recordDelivery = async (itemId, qty, expiry = null) => {
    if (qty <= 0) return;
    const ref = doc(db, "stockItems", itemId);
    await updateDoc(ref, {
      quantity: increment(qty),
      ...(expiry && { expiryDate: expiry }),
    });
    setMovementQty(0);
    setSelectedItem(null);
  };

  const useStock = async (itemId, qty) => {
    if (qty <= 0) return;
    const ref = doc(db, "stockItems", itemId);
    await updateDoc(ref, { quantity: increment(-qty) });
    setMovementQty(0);
    setSelectedItem(null);
  };

  const deleteStockItem = async (itemId) => {
    await deleteDoc(doc(db, "stockItems", itemId));
  };

  // Update Firestore with debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      Object.entries(editBuffer).forEach(([id, fields]) => {
        Object.entries(fields).forEach(([field, value]) => {
          const ref = doc(db, "stockItems", id);
          updateDoc(ref, { [field]: value }).catch(console.error);
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

  const filteredHACCP = haccpPoints.map((ccp) => ({ value: ccp.id, label: ccp.name }));

  // -------------------------
  // OCR HELPERS (added)
  // -------------------------
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
    // e.g. "500g", "0.5kg", "2kg"
    const m = s.match(/(\d+(?:[\.,]\d+)?)(kg|g|l|ml)/i);
    if (!m) return { qty: 1, measurement: "unit", rawWeight: weightStr };

    const num = Number(m[1].replace(",", "."));
    const unit = m[2];

    if (unit === "kg") return { qty: num, measurement: "kg", rawWeight: weightStr };
    if (unit === "g") return { qty: gramsToKg(num), measurement: "kg", rawWeight: weightStr };
    // If you want liquids later, adapt here:
    if (unit === "l") return { qty: num, measurement: "unit", rawWeight: weightStr };
    if (unit === "ml") return { qty: num / 1000, measurement: "unit", rawWeight: weightStr };

    return { qty: 1, measurement: "unit", rawWeight: weightStr };
  };

  const parseReceiptText = (text) => {
    // Split lines, keep non-empty
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      // remove obvious headers/footers (very lightweight)
      .filter((l) => !/total|subtotal|vat|change/i.test(l));

    // Build items (best-effort)
    const items = [];
    for (const line of lines) {
      // Try to find price and weight within the same line
      const priceMatch = line.match(/£\s*\d+(?:[\.,]\d{2})?|\d+(?:[\.,]\d{2})\s*£/i) || line.match(/\b\d+(?:[\.,]\d{2})\b/);
      const weightMatch = line.match(/(\d+(?:[\.,]\d+)?)(kg|g|ml|l)\b/i);

      // Build name by removing obvious bits
      let name = line;
      if (priceMatch) name = name.replace(priceMatch[0], "");
      if (weightMatch) name = name.replace(weightMatch[0], "");
      name = name.replace(/\s{2,}/g, " ").trim();

      // Skip barcode-only lines etc.
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
        price: price,
        rawWeight,
        location: "Ambient",
        expiryDate: "",
        supplier: newSupplier || "", // prefer currently chosen supplier if any
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
      const { data: { text } } = await Tesseract.recognize(file, "eng");
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
      // reset file input so same image can be selected again if needed
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
        await addDoc(collection(db, "stockItems"), {
          name: it.name,
          quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
          measurement: it.measurement || "unit",
          location: it.location || "Ambient",
          expiryDate: it.expiryDate || null,
          supplier: it.supplier || newSupplier || "Unknown",
          haccpPoints: [],
          site,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
          ...(it.price != null ? { price: Number(it.price) } : {}),
          ...(it.rawWeight ? { parsedWeight: it.rawWeight } : {}),
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

  // --- JSX ---
  return (
    <div className="p-4 bg-white shadow rounded-xl">
      <h2 className="text-xl font-bold mb-3">Stock Management — {site}</h2>

      {/* Upload Receipt (OCR) - added */}
      <div className="mb-6 p-3 border rounded bg-gray-50">
        <h3 className="font-semibold mb-2">Add from receipt (photo)</h3>
        <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoUpload}
            className="border p-2 rounded w-full md:w-auto"
          />
          <select
            value={newSupplier}
            onChange={(e) => setNewSupplier(e.target.value)}
            className="border p-2 rounded md:w-60"
            title="Supplier for OCR-added items"
          >
            <option value="">Select supplier (optional)</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.name}>
                {sup.name}
              </option>
            ))}
          </select>
        </div>

        {ocrLoading && (
          <div className="mt-3 text-sm text-gray-600">Reading receipt… this can take a moment.</div>
        )}
        {ocrError && (
          <div className="mt-3 text-sm text-red-600">{ocrError}</div>
        )}

        {/* OCR Preview */}
        {ocrItems.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium">
                Parsed items from <span className="italic">{ocrImageName || "image"}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOcrItems((prev) => prev.map((i) => ({ ...i, selected: true })))}
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  Select all
                </button>
                <button
                  onClick={() => setOcrItems((prev) => prev.map((i) => ({ ...i, selected: false })))}
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  Deselect all
                </button>
                <button
                  onClick={() => { setOcrItems([]); setOcrError(""); setOcrImageName(""); }}
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Add</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Qty</th>
                    <th className="text-left p-2">Meas.</th>
                    <th className="text-left p-2">Supplier</th>
                    <th className="text-left p-2">Location</th>
                    <th className="text-left p-2">Expiry</th>
                    <th className="text-left p-2">Price (£)</th>
                    <th className="text-left p-2">Parsed weight</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrItems.map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="p-2 align-middle">
                        <input
                          type="checkbox"
                          checked={!!it.selected}
                          onChange={(e) => updateOcrItem(it.id, "selected", e.target.checked)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={it.name}
                          onChange={(e) => updateOcrItem(it.id, "name", e.target.value)}
                          className="border p-1 rounded w-48"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={it.quantity}
                          onChange={(e) => updateOcrItem(it.id, "quantity", Number(e.target.value))}
                          className="border p-1 rounded w-24"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={it.measurement}
                          onChange={(e) => updateOcrItem(it.id, "measurement", e.target.value)}
                          className="border p-1 rounded w-24"
                        >
                          <option value="unit">Units</option>
                          <option value="kg">Kilograms</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={it.supplier || ""}
                          onChange={(e) => updateOcrItem(it.id, "supplier", e.target.value)}
                          className="border p-1 rounded w-40"
                        >
                          <option value="">(none)</option>
                          {suppliers.map((sup) => (
                            <option key={sup.id} value={sup.name}>
                              {sup.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={it.location}
                          onChange={(e) => updateOcrItem(it.id, "location", e.target.value)}
                          className="border p-1 rounded w-40"
                        >
                          <option value="Ambient">Ambient</option>
                          {equipment.map((eq) => (
                            <option key={eq.id} value={eq.name || eq.id}>
                              {eq.name || eq.type}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="date"
                          value={it.expiryDate || ""}
                          onChange={(e) => updateOcrItem(it.id, "expiryDate", e.target.value)}
                          className="border p-1 rounded w-40"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={it.price ?? ""}
                          onChange={(e) =>
                            updateOcrItem(it.id, "price", e.target.value === "" ? null : Number(e.target.value))
                          }
                          className="border p-1 rounded w-24"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="p-2 text-gray-500">{it.rawWeight || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={addSelectedOcrItems}
              className="mt-3 bg-green-600 text-white px-4 py-2 rounded"
            >
              Add selected items
            </button>
          </div>
        )}
      </div>

      {/* Add stock item */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <input
          type="text"
          placeholder="Item name"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="border p-2 rounded md:col-span-2"
        />
        <input
          type="number"
          placeholder="Qty"
          value={newItemQty}
          onChange={(e) => setNewItemQty(e.target.value)}
          className="border p-2 rounded md:col-span-1"
        />
        <select
          value={newMeasurement}
          onChange={(e) => setNewMeasurement(e.target.value)}
          className="border p-2 rounded md:col-span-1"
        >
          <option value="unit">Units</option>
          <option value="kg">Kilograms</option>
        </select>
        <select
          value={newLocation}
          onChange={(e) => setNewLocation(e.target.value)}
          className="border p-2 rounded md:col-span-2"
        >
          <option value="Ambient">Ambient</option>
          {equipment.map((eq) => (
            <option key={eq.id} value={eq.name || eq.id}>
              {eq.name || eq.type}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={newExpiry}
          onChange={(e) => setNewExpiry(e.target.value)}
          className="border p-2 rounded md:col-span-2"
        />
        <select
          value={newSupplier}
          onChange={(e) => setNewSupplier(e.target.value)}
          className="border p-2 rounded md:col-span-2"
        >
          <option value="">Select supplier</option>
          {suppliers.map((sup) => (
            <option key={sup.id} value={sup.name}>
              {sup.name}
            </option>
          ))}
        </select>
        <div className="md:col-span-2">
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
        <button
          onClick={addStockItem}
          className="bg-green-600 text-white px-4 py-2 rounded md:col-span-12 mt-2"
        >
          Add Item
        </button>
      </div>

      {/* Stock list with editable fields */}
      <ul>
        {stockItems.map((item) => (
          <li
            key={item.id}
            className="flex flex-col md:flex-row md:justify-between md:items-center border-b py-2 gap-2"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <input
                type="text"
                value={editBuffer[item.id]?.name ?? item.name}
                onChange={(e) => handleEdit(item.id, "name", e.target.value)}
                className="border p-1 rounded w-32"
              />
              <input
                type="number"
                value={editBuffer[item.id]?.quantity ?? item.quantity}
                onChange={(e) => handleEdit(item.id, "quantity", Number(e.target.value))}
                className="border p-1 rounded w-20"
              />
              <select
                value={editBuffer[item.id]?.measurement ?? item.measurement}
                onChange={(e) => handleEdit(item.id, "measurement", e.target.value)}
                className="border p-1 rounded w-24"
              >
                <option value="unit">Units</option>
                <option value="kg">Kilograms</option>
              </select>
              <select
                value={editBuffer[item.id]?.location ?? item.location}
                onChange={(e) => handleEdit(item.id, "location", e.target.value)}
                className="border p-1 rounded w-32"
              >
                <option value="Ambient">Ambient</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.name || eq.id}>
                    {eq.name || eq.type}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={(editBuffer[item.id]?.expiryDate ?? item.expiryDate) || ""}
                onChange={(e) => handleEdit(item.id, "expiryDate", e.target.value)}
                className="border p-1 rounded w-32"
              />
              <select
                value={(editBuffer[item.id]?.supplier ?? item.supplier) || ""}
                onChange={(e) => handleEdit(item.id, "supplier", e.target.value)}
                className="border p-1 rounded w-32"
              >
                <option value="">Select supplier</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.name}>
                    {sup.name}
                  </option>
                ))}
              </select>

              {/* Price (optional) */}
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
                className="border p-1 rounded w-24"
                placeholder="£"
                title="Item price (optional)"
              />
            </div>

            <div className="flex gap-2 mt-2 md:mt-0">
              <button
                onClick={() => setSelectedItem(item)}
                className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
              >
                Delivery
              </button>
              <button
                onClick={() => setSelectedItem(item)}
                className="bg-orange-500 text-white px-2 py-1 rounded text-sm"
              >
                Use
              </button>
              <button
                onClick={() => deleteStockItem(item.id)}
                className="bg-red-600 text-white px-2 py-1 rounded text-sm"
              >
                X
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Movement input */}
      {selectedItem && (
        <div className="mt-4 p-3 border rounded bg-gray-50">
          <h3 className="font-semibold mb-2">
            Adjust {selectedItem.name} stock
          </h3>
          <input
            type="number"
            step={selectedItem.measurement === "kg" ? "0.1" : "1"}
            value={movementQty}
            onChange={(e) => setMovementQty(Number(e.target.value))}
            className="border p-2 rounded w-24 mr-2"
          />
          <button
            onClick={() =>
              recordDelivery(selectedItem.id, movementQty, selectedItem.expiryDate)
            }
            className="bg-blue-600 text-white px-3 py-1 rounded mr-2"
          >
            + Delivery
          </button>
          <button
            onClick={() => useStock(selectedItem.id, movementQty)}
            className="bg-orange-600 text-white px-3 py-1 rounded"
          >
            - Usage
          </button>
        </div>
      )}

      {/* Add supplier */}
      <div className="mt-6 p-3 border rounded bg-gray-50">
        <h3 className="font-semibold mb-2">Add Supplier</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Supplier name"
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
            className="border p-2 rounded flex-1"
          />
          <button
            onClick={addSupplier}
            className="bg-purple-600 text-white px-4 py-2 rounded"
          >
            Add
          </button>
        </div>
      </div>

      {/* Back button */}
      <button
        onClick={goBack}
        className="mt-6 bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
      >
        Back
      </button>
    </div>
  );
};

export default StockSection;