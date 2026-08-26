// src/components/GoodsInSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  onSnapshot,
  increment,
  serverTimestamp,
  query,
  where,
  writeBatch,
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

const DELIVERY_DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const toLocalDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const GoodsInSection = ({
  site,
  goBack,
  user,
  initialDeliveryDate = "",
  initialSupplier = "",
  openingMode = false,
  onDeliverySaved,
}) => {
  const today = toLocalDateInput(new Date());

  const [stockItems, setStockItems] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [goodsInRecords, setGoodsInRecords] = useState([]);
  const [measurements, setMeasurements] = useState([]);

const [locations, setLocations] = useState([]);

const [deliveryStatuses, setDeliveryStatuses] = useState([]);
const [goodsInFilter, setGoodsInFilter] = useState("30");
const [editingGoodsInId, setEditingGoodsInId] = useState("");
const [editedDeliveryDate, setEditedDeliveryDate] = useState("");
const [dateUpdateSaving, setDateUpdateSaving] = useState(false);

  const [supplier, setSupplier] = useState(initialSupplier || "");
  const [deliveryRef, setDeliveryRef] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(initialDeliveryDate || today);
  const [notes, setNotes] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierDeliveryDays, setNewSupplierDeliveryDays] = useState([]);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [scheduleSaving, setScheduleSaving] = useState("");

  const isManager =
    ["manager", "admin"].includes((user?.role || "").toLowerCase()) ||
    ["chris", "chloe"].includes((user?.name || user?.displayName || "").toLowerCase()) ||
    ["christopher.wright@oaknsmkbbq.com"].includes((user?.email || "").toLowerCase());

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
    if (initialDeliveryDate) setDeliveryDate(initialDeliveryDate);
  }, [initialDeliveryDate]);

  useEffect(() => {
    if (initialSupplier) setSupplier(initialSupplier);
  }, [initialSupplier]);

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

useEffect(() => {
  if (!site) return;

  const q = query(collection(db, "goodsIn"), where("site", "==", site));

  const unsub = onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const dateCompare = (b.deliveryDate || "").localeCompare(
          a.deliveryDate || ""
        );
        if (dateCompare !== 0) return dateCompare;

        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

    setGoodsInRecords(rows);
  });

  return () => unsub();
}, [site]);

useEffect(() => {
  if (!site) return;

  const qOptions = query(
    collection(db, "adminOptions"),
    where("site", "==", site)
  );

  const unsub = onSnapshot(qOptions, (snapshot) => {
    const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    setMeasurements(
      rows
        .filter((r) => r.type === "measurements")
        .sort((a, b) => (a.value || "").localeCompare(b.value || ""))
    );

    setLocations(
      rows
        .filter((r) => r.type === "locations")
        .sort((a, b) => (a.value || "").localeCompare(b.value || ""))
    );

    setDeliveryStatuses(
      rows
        .filter((r) => r.type === "deliveryStatuses")
        .sort((a, b) => (a.value || "").localeCompare(b.value || ""))
    );
  });

  return () => unsub();
}, [site]);

const filteredGoodsInRecords = goodsInRecords.filter((record) => {
  if (goodsInFilter === "all") return true;

  const days = Number(goodsInFilter);
  const recordDate = record.deliveryDate ? new Date(record.deliveryDate) : null;

  if (!recordDate || Number.isNaN(recordDate.getTime())) return true;

  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);

  return recordDate >= from;
});

  const scheduledSupplierCount = suppliers.filter(
    (supplierRow) =>
      Array.isArray(supplierRow.deliveryDays) &&
      supplierRow.deliveryDays.length > 0
  ).length;
  const adHocSupplierCount = suppliers.length - scheduledSupplierCount;

  const filteredScheduleSuppliers = useMemo(() => {
    const search = scheduleSearch.trim().toLowerCase();

    return suppliers
      .filter((supplierRow) => {
        const deliveryDays = Array.isArray(supplierRow.deliveryDays)
          ? supplierRow.deliveryDays
          : [];
        const matchesSearch =
          !search || (supplierRow.name || "").toLowerCase().includes(search);
        const matchesFilter =
          scheduleFilter === "all" ||
          (scheduleFilter === "scheduled" && deliveryDays.length > 0) ||
          (scheduleFilter === "ad-hoc" && deliveryDays.length === 0);

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [suppliers, scheduleSearch, scheduleFilter]);

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

  const toggleNewSupplierDeliveryDay = (day) => {
    setNewSupplierDeliveryDays((prev) =>
      prev.includes(day)
        ? prev.filter((value) => value !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toggleSupplierDeliveryDay = async (supplierRow, day) => {
    const currentDays = Array.isArray(supplierRow.deliveryDays)
      ? supplierRow.deliveryDays.map(Number)
      : [];
    const nextDays = currentDays.includes(day)
      ? currentDays.filter((value) => value !== day)
      : [...currentDays, day].sort((a, b) => a - b);
    const savingKey = `${supplierRow.id}_${day}`;

    setScheduleSaving(savingKey);
    setSuppliers((prev) =>
      prev.map((row) =>
        row.id === supplierRow.id ? { ...row, deliveryDays: nextDays } : row
      )
    );

    try {
      await updateDoc(doc(db, "suppliers", supplierRow.id), {
        deliveryDays: nextDays,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || user?.id || null,
      });
    } catch (error) {
      console.error("Error updating supplier delivery schedule:", error);
      setSuppliers((prev) =>
        prev.map((row) =>
          row.id === supplierRow.id
            ? { ...row, deliveryDays: currentDays }
            : row
        )
      );
      alert("Failed to update this supplier's delivery schedule.");
    } finally {
      setScheduleSaving("");
    }
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

      deliveryDays: newSupplierDeliveryDays,

      createdAt: serverTimestamp(),

      createdBy: user?.uid || null,

    });

    setSupplier(cleanName);

    setNewSupplierName("");

    setNewSupplierDeliveryDays([]);

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
        status: deliveryStatuses[0]?.value || "posted-to-stock",
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
            lastReceivedDate: deliveryDate,
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

      const savedDelivery = {
        id: deliveryDoc.id,
        supplier,
        deliveryDate,
      };

      alert(
        openingMode
          ? "Goods in saved and stock updated. Returning to the opening checklist."
          : "Goods in saved and stock updated."
      );

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

      if (openingMode) {
        if (onDeliverySaved) {
          onDeliverySaved(savedDelivery);
        } else {
          goBack?.();
        }
      }
    } catch (error) {
      console.error("Error saving goods in:", error);
      alert("Failed to save goods in.");
    }
  };

  const startEditingDeliveryDate = (record) => {
    setEditingGoodsInId(record.id);
    setEditedDeliveryDate(record.deliveryDate || today);
  };

  const cancelEditingDeliveryDate = () => {
    setEditingGoodsInId("");
    setEditedDeliveryDate("");
  };

  const saveCorrectedDeliveryDate = async (record) => {
    if (!isManager) {
      alert("Only a manager can change a posted goods-in date.");
      return;
    }

    const correctedDate = editedDeliveryDate;

    if (!correctedDate) {
      alert("Choose the correct received date.");
      return;
    }

    if (correctedDate > today) {
      alert("The received date cannot be in the future.");
      return;
    }

    if (correctedDate === record.deliveryDate) {
      cancelEditingDeliveryDate();
      return;
    }

    const confirmed = window.confirm(
      `Change ${record.supplier || "this delivery"} from ${record.deliveryDate || "no date"} to ${correctedDate}? This updates the linked stock history but does not change quantities.`
    );

    if (!confirmed) return;

    setDateUpdateSaving(true);

    try {
      const relatedCollections = [
        { name: "goodsInLines", dateField: "deliveryDate" },
        { name: "stockBatches", dateField: "dateReceived" },
        { name: "stockMovements", dateField: "dateReceived" },
      ];

      const relatedSnapshots = await Promise.all(
        relatedCollections.map(({ name }) =>
          getDocs(
            query(
              collection(db, name),
              where("deliveryId", "==", record.id)
            )
          )
        )
      );

      const affectedStockItemIds = [
        ...new Set(
          relatedSnapshots.flatMap((snapshot) =>
            snapshot.docs
              .map((entry) => entry.data().stockItemId)
              .filter(Boolean)
          )
        ),
      ].filter((stockItemId) => stockMap[stockItemId]);

      const latestReceivedDates = await Promise.all(
        affectedStockItemIds.map(async (stockItemId) => {
          const lineSnapshot = await getDocs(
            query(
              collection(db, "goodsInLines"),
              where("stockItemId", "==", stockItemId)
            )
          );

          const receivedDates = lineSnapshot.docs
            .map((entry) => {
              const line = entry.data();
              if (line.site && line.site !== site) return null;

              return line.deliveryId === record.id
                ? correctedDate
                : line.deliveryDate;
            })
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

          return {
            stockItemId,
            lastReceivedDate:
              receivedDates[receivedDates.length - 1] || correctedDate,
          };
        })
      );

      const relatedWriteCount = relatedSnapshots.reduce(
        (total, snapshot) => total + snapshot.size,
        0
      );
      const totalWriteCount =
        2 + relatedWriteCount + latestReceivedDates.length;

      if (totalWriteCount > 500) {
        throw new Error(
          "This delivery has too many linked records to update safely in one batch."
        );
      }

      const batch = writeBatch(db);
      const correctedBy =
        user?.name || user?.displayName || user?.email || "Unknown";
      const correctedByUid = user?.uid || user?.id || null;

      batch.update(doc(db, "goodsIn", record.id), {
        deliveryDate: correctedDate,
        dateLastCorrectedFrom: record.deliveryDate || null,
        dateCorrectedAt: serverTimestamp(),
        dateCorrectedBy: correctedBy,
        dateCorrectedByUid: correctedByUid,
      });

      relatedCollections.forEach((config, index) => {
        relatedSnapshots[index].docs.forEach((entry) => {
          batch.update(entry.ref, {
            [config.dateField]: correctedDate,
          });
        });
      });

      latestReceivedDates.forEach(
        ({ stockItemId, lastReceivedDate }) => {
          batch.update(doc(db, "stockItems", stockItemId), {
            lastReceivedDate,
            updatedAt: serverTimestamp(),
          });
        }
      );

      const auditRef = doc(collection(db, "goodsInDateChanges"));
      batch.set(auditRef, {
        site,
        deliveryId: record.id,
        supplier: record.supplier || null,
        fromDate: record.deliveryDate || null,
        toDate: correctedDate,
        changedAt: serverTimestamp(),
        changedBy: correctedBy,
        changedByUid: correctedByUid,
      });

      await batch.commit();

      cancelEditingDeliveryDate();
      alert(
        "Received date updated everywhere. Stock quantities were not changed."
      );
    } catch (error) {
      console.error("Error correcting goods-in date:", error);
      alert(
        "Failed to update the received date. Check your Firestore permissions and try again."
      );
    } finally {
      setDateUpdateSaving(false);
    }
  };

  return (
    <div style={wrap}>
      <h2 style={title}>
        Goods In — <span style={{ color: "#2563eb" }}>{site}</span>
      </h2>

      {openingMode && (
        <div
          style={{
            ...card,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e3a8a",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            Opening checklist delivery reconciliation
          </div>
          <div style={{ fontSize: 13 }}>
            Record the missed delivery for {deliveryDate}. After saving, you will
            return to the opening checklist automatically.
          </div>
        </div>
      )}

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
              disabled={openingMode && !!initialDeliveryDate}
              style={{
                ...input,
                background:
                  openingMode && initialDeliveryDate ? "#f1f5f9" : "#fff",
              }}
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

  {isManager && (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...label, marginBottom: 7 }}>
        Expected delivery days optional
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {DELIVERY_DAYS.map((day) => {
          const selected = newSupplierDeliveryDays.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleNewSupplierDeliveryDay(day.value)}
              style={selected ? blueBtn : grayBtn}
            >
              {day.label}
            </button>
          );
        })}
      </div>
      <div style={{ ...subtle, marginTop: 7 }}>
        These days are used by the next opening checklist to identify missing
        deliveries.
      </div>
    </div>
  )}

</div>

      {isManager && suppliers.length > 0 && (
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ ...sectionHeader, marginBottom: 4 }}>
                <FaIndustry color="#7c3aed" />
                Supplier delivery schedules
              </div>
              <div style={subtle}>
                {scheduledSupplierCount} scheduled · {adHocSupplierCount} ad-hoc
              </div>
            </div>

            <button
              type="button"
              onClick={() => setScheduleExpanded((current) => !current)}
              style={scheduleExpanded ? blueBtn : grayBtn}
            >
              {scheduleExpanded ? "Hide schedules ▴" : "Manage schedules ▾"}
            </button>
          </div>

          {scheduleExpanded && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <input
                  type="search"
                  value={scheduleSearch}
                  onChange={(event) => setScheduleSearch(event.target.value)}
                  placeholder="Search suppliers"
                  style={{ ...input, minWidth: 260, flex: "1 1 280px" }}
                />

                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {[
                    { value: "all", label: `All (${suppliers.length})` },
                    {
                      value: "scheduled",
                      label: `Scheduled (${scheduledSupplierCount})`,
                    },
                    { value: "ad-hoc", label: `Ad-hoc (${adHocSupplierCount})` },
                  ].map((filterOption) => (
                    <button
                      key={filterOption.value}
                      type="button"
                      onClick={() => setScheduleFilter(filterOption.value)}
                      style={
                        scheduleFilter === filterOption.value ? blueBtn : grayBtn
                      }
                    >
                      {filterOption.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ ...subtle, marginBottom: 10 }}>
                Click a day to turn it on or off. Blank rows are treated as ad-hoc
                suppliers.
              </div>

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflow: "auto",
                  maxHeight: 430,
                  background: "#fff",
                }}
              >
                <div style={{ minWidth: 720 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(230px, 1fr) repeat(7, 58px)",
                      alignItems: "center",
                      minHeight: 44,
                      padding: "0 10px",
                      background: "#f8fafc",
                      borderBottom: "1px solid #e5e7eb",
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                      Supplier
                    </div>
                    {DELIVERY_DAYS.map((day) => (
                      <div
                        key={day.value}
                        style={{
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#475569",
                        }}
                      >
                        {day.label}
                      </div>
                    ))}
                  </div>

                  {filteredScheduleSuppliers.length === 0 ? (
                    <div style={{ padding: 18, textAlign: "center", ...subtle }}>
                      No suppliers match this search or filter.
                    </div>
                  ) : (
                    filteredScheduleSuppliers.map((supplierRow, index) => {
                      const selectedDays = Array.isArray(supplierRow.deliveryDays)
                        ? supplierRow.deliveryDays.map(Number)
                        : [];

                      return (
                        <div
                          key={supplierRow.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "minmax(230px, 1fr) repeat(7, 58px)",
                            alignItems: "center",
                            minHeight: 52,
                            padding: "0 10px",
                            background: index % 2 === 0 ? "#fff" : "#f8fafc",
                            borderBottom:
                              index === filteredScheduleSuppliers.length - 1
                                ? "none"
                                : "1px solid #eef2f7",
                          }}
                        >
                          <div style={{ minWidth: 0, paddingRight: 10 }}>
                            <div
                              style={{
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={supplierRow.name}
                            >
                              {supplierRow.name}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                marginTop: 2,
                                color: selectedDays.length ? "#166534" : "#64748b",
                              }}
                            >
                              {selectedDays.length
                                ? `${selectedDays.length} day${
                                    selectedDays.length === 1 ? "" : "s"
                                  } scheduled`
                                : "Ad-hoc"}
                            </div>
                          </div>

                          {DELIVERY_DAYS.map((day) => {
                            const selected = selectedDays.includes(day.value);
                            const savingKey = `${supplierRow.id}_${day.value}`;
                            const saving = scheduleSaving === savingKey;

                            return (
                              <div key={day.value} style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  aria-label={`${selected ? "Remove" : "Add"} ${
                                    day.label
                                  } delivery for ${supplierRow.name}`}
                                  aria-pressed={selected}
                                  disabled={saving}
                                  onClick={() =>
                                    toggleSupplierDeliveryDay(
                                      supplierRow,
                                      day.value
                                    )
                                  }
                                  style={{
                                    width: 36,
                                    height: 34,
                                    borderRadius: 9,
                                    border: selected
                                      ? "1px solid #7c3aed"
                                      : "1px solid #e2e8f0",
                                    background: selected ? "#7c3aed" : "#fff",
                                    color: selected ? "#fff" : "#94a3b8",
                                    fontWeight: 900,
                                    fontSize: 15,
                                    cursor: saving ? "wait" : "pointer",
                                    opacity: saving ? 0.6 : 1,
                                  }}
                                  title={`${day.label}: ${
                                    selected ? "scheduled" : "not scheduled"
                                  }`}
                                >
                                  {selected ? "✓" : "·"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
{measurements.length === 0 ? (

  <>

    <option value="unit">Units</option>

    <option value="slice">Slices</option>

    <option value="portion">Portions</option>

    <option value="kg">Kilograms</option>

     <option value="ml">Milliliter</option>

  </>

) : (

  measurements.map((m) => (

    <option key={m.id} value={m.value}>

      {m.value}

    </option>

  ))

)}
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
{locations.length === 0 ? (

  <>

    <option value="Ambient">Ambient</option>

    {equipment.map((eq) => (

      <option key={eq.id} value={eq.name || eq.id}>

        {eq.name || eq.type}

      </option>

    ))}

  </>

) : (

  locations.map((loc) => (

    <option key={loc.id} value={loc.value}>

      {loc.value}

    </option>

  ))

)}
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

          <FaTruckLoading color="#2563eb" />

          Recent goods in records

        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>

  {[

    { label: "7 days", value: "7" },

    { label: "30 days", value: "30" },

    { label: "90 days", value: "90" },

    { label: "All", value: "all" },

  ].map((option) => (

    <button

      key={option.value}

      onClick={() => setGoodsInFilter(option.value)}

      style={goodsInFilter === option.value ? blueBtn : grayBtn}

    >

      {option.label}

    </button>

  ))}

</div>

        {filteredGoodsInRecords.length === 0 ? (

          <div style={subtle}>No goods in records yet.</div>

        ) : (

          <div style={{ display: "grid", gap: 10 }}>

            {filteredGoodsInRecords.slice(0, 100).map((record) => (

              <div

                key={record.id}

                style={{

                  border: "1px solid #e5e7eb",

                  borderRadius: 12,

                  padding: 12,

                  background: "#f9fafb",

                  display: "grid",

                  gap: 4,

                }}

              >

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >

                  <div style={{ fontWeight: 800 }}>

                    {record.supplier || "Unknown supplier"}

                  </div>

                  {isManager && editingGoodsInId !== record.id && (

                    <button
                      type="button"
                      onClick={() => startEditingDeliveryDate(record)}
                      disabled={!!editingGoodsInId || dateUpdateSaving}
                      style={{
                        ...grayBtn,
                        padding: "7px 10px",
                        fontSize: 12,
                        opacity:
                          editingGoodsInId || dateUpdateSaving ? 0.55 : 1,
                        cursor:
                          editingGoodsInId || dateUpdateSaving
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      Change date
                    </button>

                  )}

                </div>

                {editingGoodsInId === record.id ? (

                  <div
                    style={{
                      display: "flex",
                      alignItems: "end",
                      gap: 8,
                      flexWrap: "wrap",
                      padding: 10,
                      margin: "4px 0",
                      borderRadius: 10,
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                    }}
                  >

                    <div style={fieldWrap}>
                      <label style={label}>Correct received date</label>
                      <input
                        type="date"
                        value={editedDeliveryDate}
                        max={today}
                        onChange={(event) =>
                          setEditedDeliveryDate(event.target.value)
                        }
                        disabled={dateUpdateSaving}
                        style={{ ...smallInput, minWidth: 160 }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => saveCorrectedDeliveryDate(record)}
                      disabled={dateUpdateSaving}
                      style={{
                        ...blueBtn,
                        padding: "8px 11px",
                        opacity: dateUpdateSaving ? 0.65 : 1,
                      }}
                    >
                      {dateUpdateSaving ? "Saving..." : "Save date"}
                    </button>

                    <button
                      type="button"
                      onClick={cancelEditingDeliveryDate}
                      disabled={dateUpdateSaving}
                      style={{ ...grayBtn, padding: "8px 11px" }}
                    >
                      Cancel
                    </button>

                    <div style={{ ...subtle, flexBasis: "100%" }}>
                      This updates the linked goods-in lines, batches, and stock
                      movements. Quantities stay the same.
                    </div>

                  </div>

                ) : (

                  <div style={subtle}>

                    Date: {record.deliveryDate || "—"} · Lines: {record.lineCount || 0}

                  </div>

                )}

                <div style={subtle}>

                  Ref: {record.deliveryRef || "No ref"} · Status: {record.status || "—"}

                </div>

                <div style={subtle}>

                  Added by: {record.createdBy || "Unknown"}

                </div>

                {record.dateCorrectedAt && (

                  <div style={{ ...subtle, color: "#1d4ed8" }}>

                    Date last corrected by: {record.dateCorrectedBy || "Unknown"}

                  </div>

                )}

                {record.notes && (

                  <div style={{ ...subtle, marginTop: 4 }}>

                    Notes: {record.notes}

                  </div>

                )}

              </div>

            ))}

          </div>

        )}

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
