import React, { useState, useEffect } from "react";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const CookingSection = ({ tempChecks, setTempChecks, site, user, goBack }) => {
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [newTemp, setNewTemp] = useState("");
  const [viewingRecord, setViewingRecord] = useState(null);

  // Fetch cooking equipment from Firestore on mount
  useEffect(() => {
    const fetchCookingEquipment = async () => {
      try {
        const snapshot = await getDocs(collection(db, "equipment"));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const cooking = data.filter(e => e.site === site && e.type === "Cooking");

        setTempChecks(prev => {
          // avoid duplicates
          const existingIds = new Set(prev.map(e => e.id));
          const newCooking = cooking.filter(e => !existingIds.has(e.id));
          return [...prev, ...newCooking];
        });
      } catch (error) {
        console.error("Error fetching cooking equipment:", error);
      }
    };

    fetchCookingEquipment();
  }, [site, setTempChecks]);

  // Only show cooking equipment for this site
  const cookingEquipment = tempChecks.filter(eq => eq.site === site && eq.type === "Cooking");

  const generateId = () => "_" + Math.random().toString(36).substr(2, 9);

  const addRecord = async () => {
    if (!newTemp.trim() || !selectedEquipment) return;

    const now = new Date();
    const record = {
      id: generateId(),
      temp: newTemp,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      person: typeof user === "string" ? user : user?.name || "Unknown",
    };

    // Update tempChecks array locally
    const updated = tempChecks.map(eq =>
      eq.id === selectedEquipment.id
        ? { ...eq, records: [...(eq.records || []), record] }
        : eq
    );
    setTempChecks(updated);
    setNewTemp("");

    // Update Firestore
    try {
      const eqRef = doc(db, "equipment", selectedEquipment.id);
      await updateDoc(eqRef, {
        records: [...(selectedEquipment.records || []), record]
      });
    } catch (error) {
      console.error("Error updating Firestore record:", error);
    }
  };

  const viewRecord = (eq, rec) => setViewingRecord({ equipment: eq, record: rec });
  const resetView = () => { setSelectedEquipment(null); setViewingRecord(null); setNewTemp(""); };

  return (
    <div style={{ padding: "30px", textAlign: "center" }}>
      <h1>{site} - Cooking & Cooling</h1>

      {/* Main list */}
      {!selectedEquipment && !viewingRecord && (
        <>
          {cookingEquipment.length === 0 && <p>No cooking equipment yet</p>}

          {cookingEquipment.map(eq => (
            <div
              key={eq.id}
              style={{ border: "1px solid #ccc", padding: "10px", margin: "10px", borderRadius: "5px", cursor: "pointer" }}
              onClick={() => setSelectedEquipment(eq)}
            >
              <h3>{eq.name}</h3>
              <p>{(eq.records || []).length} records</p>
            </div>
          ))}

          <button onClick={goBack} style={{ marginTop: "20px", padding: "10px 20px" }}>Back</button>
        </>
      )}

      {/* Selected equipment */}
      {selectedEquipment && !viewingRecord && (
        <>
          <h2>{selectedEquipment.name}</h2>
          <input
            type="text"
            placeholder="Enter usage or temperature"
            value={newTemp}
            onChange={e => setNewTemp(e.target.value)}
          />
          <button onClick={addRecord}>Add Record</button>

          <h3>Previous Records</h3>
          {(selectedEquipment.records || []).map(rec => (
            <div key={rec.id} onClick={() => viewRecord(selectedEquipment, rec)}>
              <p>{rec.temp} | {rec.date} {rec.time} | {rec.person}</p>
            </div>
          ))}

          <button onClick={resetView} style={{ marginTop: "15px", padding: "10px 20px" }}>Back</button>
        </>
      )}

      {/* Single record view */}
      {viewingRecord && (
        <>
          <h2>{viewingRecord.equipment.name} - Record</h2>
          <p>Value: {viewingRecord.record.temp}</p>
          <p>Date: {viewingRecord.record.date}</p>
          <p>Time: {viewingRecord.record.time}</p>
          <p>Recorded by: {viewingRecord.record.person}</p>
          <button onClick={resetView} style={{ marginTop: "15px", padding: "10px 20px" }}>Back</button>
        </>
      )}
    </div>
  );
};

export default CookingSection;