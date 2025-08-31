import React, { useState } from "react";

const EquipmentManager = ({ site, tempChecks, setTempChecks, goBack }) => {
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("Other");

  const generateId = () => "_" + Math.random().toString(36).substr(2, 9);

  const addEquipment = () => {
    if (!equipmentName.trim()) return;

    const newEquipment = {
      id: generateId(),
      site,
      name: equipmentName,
      type: equipmentType, // "Fridge", "Freezer", "Cooking", "Other"
      records: [], // Always initialize records
    };

    // Add to main tempChecks array for all types
    setTempChecks([...tempChecks, newEquipment]);

    setEquipmentName("");
    setEquipmentType("Other");
    goBack(); // Return to site dashboard
  };

  return (
    <div style={{ padding: "30px", textAlign: "center" }}>
      <h1>Add Equipment - {site}</h1>

      <input
        type="text"
        placeholder="Equipment Name e.g. Fridge 1 or Griddle 2"
        value={equipmentName}
        onChange={(e) => setEquipmentName(e.target.value)}
        style={{ padding: "10px", fontSize: "16px", width: "300px", borderRadius: "5px" }}
      />
      <br />

      <select
        value={equipmentType}
        onChange={(e) => setEquipmentType(e.target.value)}
        style={{ padding: "10px", fontSize: "16px", marginTop: "15px", borderRadius: "5px" }}
      >
        <option value="Fridge">Fridge</option>
        <option value="Freezer">Freezer</option>
        <option value="Cooking">Cooking Equipment</option>
        <option value="Other">Other</option>
      </select>
      <br />

      <button
        onClick={addEquipment}
        style={{ marginTop: "20px", padding: "10px 20px", fontSize: "16px", borderRadius: "5px", cursor: "pointer" }}
      >
        Save Equipment
      </button>
      <br />

      <button
        onClick={goBack}
        style={{ marginTop: "15px", padding: "10px 20px", fontSize: "16px", borderRadius: "8px", cursor: "pointer" }}
      >
        Back
      </button>
    </div>
  );
};

export default EquipmentManager;