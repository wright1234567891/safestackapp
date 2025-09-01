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

const StockSection = ({ site, goBack, user }) => {
  const [stockItems, setStockItems] = useState([]);
  const [equipment, setEquipment] = useState([]); 
  const [suppliers, setSuppliers] = useState([]); 

  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(0);
  const [newLocation, setNewLocation] = useState("Ambient");
  const [newExpiry, setNewExpiry] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [movementQty, setMovementQty] = useState(0);

  const [newSupplierName, setNewSupplierName] = useState(""); 

  // Stock updates
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setStockItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // Equipment updates
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

  // Suppliers updates
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "suppliers"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setSuppliers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // Add stock item
  const addStockItem = async () => {
    if (!newItemName || newItemQty <= 0 || !newSupplier) return;
    await addDoc(collection(db, "stockItems"), {
      name: newItemName,
      quantity: Number(newItemQty),
      location: newLocation,
      expiryDate: newExpiry || null,
      supplier: newSupplier,
      site,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });
    setNewItemName("");
    setNewItemQty(0);
    setNewLocation("Ambient");
    setNewExpiry("");
    setNewSupplier("");
  };

  // Add supplier
  const addSupplier = async () => {
    if (!newSupplierName) return;
    await addDoc(collection(db, "suppliers"), {
      name: newSupplierName,
      site,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });
    setNewSupplierName("");
  };

  // Record stock delivery
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

  // Record usage
  const useStock = async (itemId, qty) => {
    if (qty <= 0) return;
    const ref = doc(db, "stockItems", itemId);
    await updateDoc(ref, { quantity: increment(-qty) });
    setMovementQty(0);
    setSelectedItem(null);
  };

  // Delete stock
  const deleteStockItem = async (itemId) => {
    await deleteDoc(doc(db, "stockItems", itemId));
  };

  return (
    <div className="p-4 bg-white shadow rounded-xl">
      <h2 className="text-xl font-bold mb-3">Stock Management — {site}</h2>

      {/* Add stock item */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input
          type="text"
          placeholder="Item name"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="number"
          placeholder="Qty"
          value={newItemQty}
          onChange={(e) => setNewItemQty(e.target.value)}
          className="border p-2 rounded"
        />
        <select
          value={newLocation}
          onChange={(e) => setNewLocation(e.target.value)}
          className="border p-2 rounded"
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
          className="border p-2 rounded"
        />
        <select
          value={newSupplier}
          onChange={(e) => setNewSupplier(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Select supplier</option>
          {suppliers.map((sup) => (
            <option key={sup.id} value={sup.name}>
              {sup.name}
            </option>
          ))}
        </select>
        <button
          onClick={addStockItem}
          className="bg-green-600 text-white px-4 py-2 rounded col-span-1 md:col-span-6"
        >
          Add Item
        </button>
      </div>

      {/* Stock list */}
      <ul>
        {stockItems.map((item) => (
          <li
            key={item.id}
            className="flex flex-col md:flex-row md:justify-between md:items-center border-b py-2"
          >
            <span>
              <strong>{item.name}</strong> — {item.quantity} units <br />
              <span className="text-sm text-gray-600">
                Location: {item.location} | Expiry:{" "}
                {item.expiryDate ? item.expiryDate : "N/A"} | Supplier:{" "}
                {item.supplier || "N/A"}
              </span>
            </span>
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