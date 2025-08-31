import React, { useState } from "react";

const defaultTasks = [
  "Griddle cleaned",
  "Hob cleaned",
  "Counter cleaned",
  "Floor cleaned",
  "Fridge/freezer cleaned",
  "Bins emptied"
];

const CleaningSection = ({ goBack, site, user, cleaningRecords, setCleaningRecords }) => {
  const [selectedTask, setSelectedTask] = useState("");

  const generateId = () => "_" + Math.random().toString(36).substr(2, 9);

  const addRecord = () => {
    if (!selectedTask) return;

    const now = new Date();
    const record = {
      id: generateId(),
      task: selectedTask,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      person: user || "Unknown"
    };

    setCleaningRecords(prev => [record, ...prev]);
    setSelectedTask("");
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
        {defaultTasks.map(task => (
          <option key={task} value={task}>{task}</option>
        ))}
      </select>
      <br />

      <button
        onClick={addRecord}
        style={{ marginTop: "15px", padding: "10px 20px", fontSize: "16px", borderRadius: "5px", cursor: "pointer" }}
      >
        Add Record
      </button>

      <h3 style={{ marginTop: "30px" }}>Previous Cleaning Records</h3>
      {cleaningRecords.length === 0 ? (
        <p>No cleaning records yet</p>
      ) : (
        <div style={{ textAlign: "left", maxWidth: "500px", margin: "0 auto" }}>
          {cleaningRecords.map(rec => (
            <div key={rec.id} style={{ borderBottom: "1px solid #ccc", padding: "5px 0" }}>
              <strong>{rec.task}</strong> | {rec.date} {rec.time} | {rec.person}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={goBack}
        style={{ marginTop: "20px", padding: "10px 20px", fontSize: "16px", borderRadius: "8px", cursor: "pointer" }}
      >
        Back
      </button>
    </div>
  );
};

export default CleaningSection;