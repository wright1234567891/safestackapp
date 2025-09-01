import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";

const defaultTasks = [
  "Griddle cleaned",
  "Hob cleaned",
  "Counter cleaned",
  "Floor cleaned",
  "Fridge/freezer cleaned",
  "Bins emptied",
];

const CleaningSection = ({ goBack, site, user, cleaningRecords, setCleaningRecords }) => {
  const [selectedTask, setSelectedTask] = useState("");

  const cleaningCollectionRef = collection(db, "cleaningRecords");

  // Fetch records from Firestore on mount
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const q = query(cleaningCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCleaningRecords(records);
      } catch (error) {
        console.error("Error fetching cleaning records: ", error);
      }
    };

    fetchRecords();
  }, [site]);

  // Add a new record to Firestore
  const addRecord = async () => {
    if (!selectedTask) return;

    const record = {
      task: selectedTask,
      person: user || "Unknown",
      site,
      createdAt: Timestamp.now(), // ✅ Firestore timestamp
    };

    try {
      const docRef = await addDoc(cleaningCollectionRef, record);
      setCleaningRecords((prev) => [{ id: docRef.id, ...record }, ...prev]);
      setSelectedTask("");
    } catch (error) {
      console.error("Error adding cleaning record: ", error);
    }
  };

  return (
    <div style={{ padding: "30px", textAlign: "center" }}>
      <h1>{site} - Cleaning Section</h1>

      <select
        value={selectedTask}
        onChange={(e) => setSelectedTask(e.target.value)}
        style={{ padding: "10px", fontSize: "16px", width: "300px", borderRadius: "5px" }}
      >
        <option value="">Select task...</option>
        {defaultTasks.map((task) => (
          <option key={task} value={task}>
            {task}
          </option>
        ))}
      </select>
      <br />

      <button
        onClick={addRecord}
        style={{
          marginTop: "15px",
          padding: "10px 20px",
          fontSize: "16px",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        Add Record
      </button>

      <h3 style={{ marginTop: "30px" }}>Previous Cleaning Records</h3>
      {cleaningRecords.length === 0 ? (
        <p>No cleaning records yet</p>
      ) : (
        <div style={{ textAlign: "left", maxWidth: "500px", margin: "0 auto" }}>
          {cleaningRecords.map((rec) => {
            const date = rec.createdAt?.toDate().toLocaleDateString();
            const time = rec.createdAt?.toDate().toLocaleTimeString();
            return (
              <div key={rec.id} style={{ borderBottom: "1px solid #ccc", padding: "5px 0" }}>
                <strong>{rec.task}</strong> | {date} {time} | {rec.person}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={goBack}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          fontSize: "16px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Back
      </button>
    </div>
  );
};

export default CleaningSection;