import React, { useState } from "react";

const TempSection = ({ tempChecks = [], setTempChecks, site, user, goBack }) => {
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [newTemp, setNewTemp] = useState("");
  const [viewingRecord, setViewingRecord] = useState(null);

  // Only show fridges/freezers for this site
  const siteTempChecks = tempChecks.filter(
    eq => eq.site === site && (eq.type === "Fridge" || eq.type === "Freezer")
  );

  const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

  const addRecord = () => {
    if (!newTemp.trim() || !selectedEquipment) return;

    const now = new Date();
    const record = {
      id: generateId(),
      temp: newTemp,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      person: typeof user === "string" ? user : user?.name || "Unknown"
    };

    const updatedTempChecks = tempChecks.map(eq =>
      eq.id === selectedEquipment.id
        ? { ...eq, records: [...(eq.records || []), record] }
        : eq
    );

    setTempChecks(updatedTempChecks);
    setNewTemp("");
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

      {/* Main list */}
      {!selectedEquipment && !viewingRecord && (
        <>
          {siteTempChecks.length === 0 && <p>No fridge/freezer equipment yet</p>}

          {siteTempChecks.map(eq => (
            <div
              key={eq.id}
              style={{ border: "1px solid #ccc", padding: "10px", margin: "10px", borderRadius: "5px", cursor: "pointer" }}
              onClick={() => setSelectedEquipment(eq)}
            >
              <h3>{eq.name}</h3>
              <p>{(eq.records || []).length} records</p>
            </div>
          ))}

          {/* Back button to SitePage */}
          <button
            onClick={goBack}
            style={{ marginTop: "20px", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}
          >
            Back
          </button>
        </>
      )}

      {/* Selected equipment */}
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

      {/* Single record view */}
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