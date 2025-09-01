import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const TempSection = ({ site, user, goBack }) => {
  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [newTemp, setNewTemp] = useState("");
  const [viewingRecord, setViewingRecord] = useState(null);

  // Fetch fridge/freezer equipment on mount
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const snapshot = await getDocs(collection(db, "equipment"));
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(eq => eq.site === site && (eq.type === "Fridge" || eq.type === "Freezer"));
        setEquipmentList(data);
      } catch (error) {
        console.error("Error fetching equipment:", error);
      }
    };
    fetchEquipment();
  }, [site]);

  const generateId = () => "_" + Math.random().toString(36).substr(2, 9);

  const addRecord = async () => {
    if (!newTemp.trim() || !selectedEquipment) return;

    const now = new Date();
    const record = {
      id: generateId(),
      temp: newTemp,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      person: typeof user === "string" ? user : user?.name || "Unknown"
    };

    // Update Firestore
    try {
      const eqRef = doc(db, "equipment", selectedEquipment.id);
      const updatedRecords = [...(selectedEquipment.records || []), record];
      await updateDoc(eqRef, { records: updatedRecords });

      // Update local state
      setEquipmentList(equipmentList.map(eq =>
        eq.id === selectedEquipment.id ? { ...eq, records: updatedRecords } : eq
      ));
      setSelectedEquipment({ ...selectedEquipment, records: updatedRecords });
      setNewTemp("");
    } catch (error) {
      console.error("Error adding temperature record:", error);
    }
  };

  const viewRecord = (eq, rec) => {
    setViewingRecord({ equipment: eq, record: rec });
  };

  const resetView = () => {
    setSelectedEquipment(null);
    setViewingRecord(null);
    setNewTemp("");
  };

  return (
    <div style={{ padding: "30px", textAlign: "center" }}>
      <h1>{site} - Temperature Checks</h1>

      {!selectedEquipment && !viewingRecord && (
        <>
          {equipmentList.length === 0 && <p>No fridge/freezer equipment yet</p>}

          {equipmentList.map(eq => (
            <div
              key={eq.id}
              style={{ border: "1px solid #ccc", padding: "10px", margin: "10px", borderRadius: "5px", cursor: "pointer" }}
              onClick={() => setSelectedEquipment(eq)}
            >
              <h3>{eq.name}</h3>
              <p>{(eq.records || []).length} records</p>
            </div>
          ))}

          <button
            onClick={goBack}
            style={{ marginTop: "20px", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}
          >
            Back
          </button>
        </>
      )}

      {selectedEquipment && !viewingRecord && (
        <>
          <h2>{selectedEquipment.name}</h2>
          <input
            type="text"
            placeholder="Enter temperature"
            value={newTemp}
            onChange={e => setNewTemp(e.target.value)}
          />
          <button onClick={addRecord}>Add Record</button>

          <h3>Previous Records</h3>
          {(selectedEquipment.records || []).map(rec => (
            <div key={rec.id} onClick={() => viewRecord(selectedEquipment, rec)}>
              <p>{rec.temp}° | {rec.date} {rec.time} | {rec.person}</p>
            </div>
          ))}

          <button onClick={resetView}>Back</button>
        </>
      )}

      {viewingRecord && (
        <>
          <h2>{viewingRecord.equipment.name} - Record</h2>
          <p>Temp: {viewingRecord.record.temp}</p>
          <p>Date: {viewingRecord.record.date}</p>
          <p>Time: {viewingRecord.record.time}</p>
          <p>Recorded by: {viewingRecord.record.person}</p>
          <button onClick={resetView}>Back</button>
        </>
      )}
    </div>
  );
};

export default TempSection;