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

  // Local buffer for edits to prevent losing text on back/return
  const [editBuffer, setEditBuffer] = useState({});

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
    }, 500); // 0.5s debounce

    return () => clearTimeout(timeout);
  }, [editBuffer]);

  const handleEdit = (itemId, field, value) => {
    setEditBuffer((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const filteredHACCP = haccpPoints.map((ccp) => ({ value: ccp.id, label: ccp.name }));

  // --- JSX ---
  return (
    <div className="p-4 bg-white shadow rounded-xl">
      <h2 className="text-xl font-bold mb-3">Stock Management — {site}</h2>

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
                value={editBuffer[item.id]?.expiryDate ?? item.expiryDate || ""}
                onChange={(e) => handleEdit(item.id, "expiryDate", e.target.value)}
                className="border p-1 rounded w-32"
              />
              <select
                value={editBuffer[item.id]?.supplier ?? item.supplier || ""}
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