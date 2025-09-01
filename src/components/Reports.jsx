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

  const reportTypes = ["HACCP", "Cleaning", "Stock", "Temperature"];

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
      stockItems: selectedStockItems,
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
          {reportTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {/* Multi-select stock items only for HACCP or Stock reports */}
        {(newReportType === "HACCP" || newReportType === "Stock") && (
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
        )}

        <button
          onClick={addReport}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Add Report
        </button>
      </div>

      {/* List reports */}
      {reports.map((report) => (
        <div
          key={report.id}
          className="border p-3 rounded bg-gray-50 mb-4"
        >
          <strong>{report.name}</strong> — Type: {report.type}

          {/* HACCP or Stock report table */}
          {(report.type === "HACCP" || report.type === "Stock") && report.stockItems?.length > 0 && (
            <table className="w-full mt-2 border-collapse border">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border px-2 py-1 text-left">Item</th>
                  <th className="border px-2 py-1 text-left">Quantity</th>
                  <th className="border px-2 py-1 text-left">Measurement</th>
                  {report.type === "HACCP" && (
                    <th className="border px-2 py-1 text-left">Linked CCPs</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {stockItems
                  .filter((item) => report.stockItems.includes(item.id))
                  .map((item) => {
                    const linkedHACCP =
                      item.haccpPoints?.length > 0
                        ? item.haccpPoints
                            .map((id) => {
                              const h = haccpPoints.find((hp) => hp.id === id);
                              return h ? h.name : id;
                            })
                            .join(", ")
                        : "N/A";
                    return (
                      <tr key={item.id}>
                        <td className="border px-2 py-1">{item.name}</td>
                        <td className="border px-2 py-1">{item.quantity}</td>
                        <td className="border px-2 py-1">{item.measurement}</td>
                        {report.type === "HACCP" && (
                          <td className="border px-2 py-1">{linkedHACCP}</td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {/* Placeholder for other report types */}
          {report.type !== "HACCP" && report.type !== "Stock" && (
            <div className="mt-2 text-gray-600 italic">
              {report.type} report data not yet implemented.
            </div>
          )}
        </div>
      ))}

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