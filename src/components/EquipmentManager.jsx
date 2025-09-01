import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const EquipmentManager = ({ site, user, tempChecks, setTempChecks, goBack }) => {
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("Other");
  const [equipmentList, setEquipmentList] = useState([]);

  // Fetch all equipment for this site on mount
  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const snapshot = await getDocs(collection(db, "equipment"));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const siteData = data.filter(e => e.site === site);
        setEquipmentList(siteData);

        // Add all existing equipment to tempChecks (for TempSection and CookingSection)
        setTempChecks(siteData);
      } catch (error) {
        console.error("Error fetching equipment:", error);
      }
    };
    fetchEquipment();
  }, [site, setTempChecks]);

  const addEquipment = async () => {
    if (!equipmentName.trim()) return;

    const newEquipment = {
      site,
      name: equipmentName,
      type: equipmentType,
      records: [], // always initialize
      addedBy: user || "Unknown",
      createdAt: new Date(),
    };

    try {
      const docRef = await addDoc(collection(db, "equipment"), newEquipment);
      const equipmentWithId = { id: docRef.id, ...newEquipment };

      // Update local list
      setEquipmentList([...equipmentList, equipmentWithId]);

      // Add all new equipment to tempChecks
      setTempChecks([...tempChecks, equipmentWithId]);

      setEquipmentName("");
      setEquipmentType("Other");
      goBack(); // return to site dashboard
    } catch (error) {
      console.error("Error adding equipment:", error);
    }
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

      {equipmentList.length > 0 && (
        <>
          <h2 style={{ marginTop: "30px" }}>Existing Equipment</h2>
          <div style={{ maxWidth: "500px", margin: "0 auto", textAlign: "left" }}>
            {equipmentList.map((eq) => (
              <div key={eq.id} style={{ borderBottom: "1px solid #ccc", padding: "5px 0" }}>
                <strong>{eq.name}</strong> | Type: {eq.type} | Added by: {eq.addedBy}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default EquipmentManager;