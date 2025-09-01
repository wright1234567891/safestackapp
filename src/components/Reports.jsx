// src/components/Reports.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

const Reports = ({ site, goBack, user }) => {
  const [reports, setReports] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [haccpPoints, setHaccpPoints] = useState([]);

  const [newReportName, setNewReportName] = useState("");
  const [newReportType, setNewReportType] = useState("HACCP");
  const [selectedStockItems, setSelectedStockItems] = useState([]);

  // Fetch existing reports
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "reports"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // Fetch stock items
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setStockItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // Fetch HACCP points
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "haccpPoints"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setHaccpPoints(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // Add new report
  const addReport = async () => {
    if (!newReportName) return;
    await addDoc(collection(db, "reports"), {
      name: newReportName,
      type: newReportType,
      site,
      stockItems: selectedStockItems, // store selected stock items
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });
    setNewReportName("");
    setSelectedStockItems([]);
  };

  return (
    <div className="p-4 bg-white shadow rounded-xl">
      <h2 className="text-xl font-bold mb-4">Reports — {site}</h2>

      {/* Add report */}
      <div className="mb-4 flex flex-col md:flex-row gap-2 items-center">
        <input
          type="text"
          placeholder="Report name"
          value={newReportName}
          onChange={(e) => setNewReportName(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <select
          value={newReportType}
          onChange={(e) => setNewReportType(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="HACCP">HACCP</option>
        </select>

        {/* Multi-select for stock items */}
        <select
          multiple
          value={selectedStockItems}
          onChange={(e) =>
            setSelectedStockItems(Array.from(e.target.selectedOptions, (o) => o.value))
          }
          className="border p-2 rounded flex-1"
        >
          {stockItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.quantity} {item.measurement})
            </option>
          ))}
        </select>

        <button
          onClick={addReport}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Add Report
        </button>
      </div>

      {/* List reports */}
      <ul className="space-y-4">
        {reports.map((report) => (
          <li
            key={report.id}
            className="border p-3 rounded bg-gray-50 flex flex-col gap-2"
          >
            <strong>{report.name}</strong> — Type: {report.type}
            <div className="ml-2">
              <h4 className="font-semibold">Stock Items linked to report:</h4>
              <ul className="list-disc ml-4">
                {stockItems
                  .filter((item) => report.stockItems?.includes(item.id))
                  .map((item) => {
                    const linkedHACCP = item.haccpPoints?.length
                      ? item.haccpPoints
                          .map((id) => {
                            const h = haccpPoints.find((hp) => hp.id === id);
                            return h ? h.name : id;
                          })
                          .join(", ")
                      : "N/A";
                    return (
                      <li key={item.id}>
                        {item.name} ({item.quantity} {item.measurement}) — HACCP: {linkedHACCP}
                      </li>
                    );
                  })}
              </ul>
            </div>
          </li>
        ))}
      </ul>

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

export default Reports;