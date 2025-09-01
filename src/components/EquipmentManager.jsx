import React, { useState } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase"; // make sure Firebase is initialized

const EquipmentManager = ({ site, user, goBack }) => {
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("Other");
  const [equipmentList, setEquipmentList] = useState([]);

  // Fetch existing equipment on mount
  React.useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const snapshot = await getDocs(collection(db, "equipment"));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEquipmentList(data.filter(e => e.site === site));
      } catch (error) {
        console.error("Error fetching equipment:", error);
      }
    };
    fetchEquipment();
  }, [site]);

  const addEquipment = async () => {
    if (!equipmentName.trim()) return;

    const newEquipment = {
      site,
      name: equipmentName,
      type: equipmentType, // "Fridge", "Freezer", "Cooking", "Other"
      records: [], // always initialize
      addedBy: user || "Unknown",
      createdAt: new Date(),
    };

    try {
      const docRef = await addDoc(collection(db, "equipment"), newEquipment);
      setEquipmentList([...equipmentList, { id: docRef.id, ...newEquipment }]);
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