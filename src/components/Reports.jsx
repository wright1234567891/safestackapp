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

  // --- fetch reports ---
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "reports"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // --- fetch stock items ---
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setStockItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // --- fetch HACCP points ---
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "haccpPoints"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setHaccpPoints(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // --- add report ---
  const addReport = async () => {
    if (!newReportName) return;

    let stockData = [];
    if (newReportType === "HACCP") {
      stockData = stockItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        measurement: item.measurement,
        haccpPoints: item.haccpPoints || [],
      }));
    }

    await addDoc(collection(db, "reports"), {
      name: newReportName,
      type: newReportType,
      site,
      stockItems: stockData,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });

    setNewReportName("");
  };

  // --- HACCP schema styled like your example ---
  const buildHaccpTable = (items) => {
    return items.map((item) => {
      const linked = item.haccpPoints?.map(
        (id) => haccpPoints.find((hp) => hp.id === id)?.name
      );

      return {
        "Process Step": item.name,
        "Food Safety Hazards": linked?.length
          ? linked.join(", ")
          : "No hazards linked",
        "Preventive Controls / Measures": "Define controls here",
        CCP: linked?.length ? "Yes" : "No",
        "Critical Limits": "Set critical limits",
        Monitoring: "Add monitoring method",
        "Corrective Actions": "Add corrective actions",
        Verification: "Add verification",
        Records: "Add records",
      };
    });
  };

  return (
    <div className="p-4 bg-white shadow rounded-xl">
      <h2 className="text-xl font-bold mb-4">Reports — {site}</h2>

      {/* --- add report form --- */}
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
          <option value="Cleaning">Cleaning</option>
          <option value="Other">Other</option>
        </select>
        <button
          onClick={addReport}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Add Report
        </button>
      </div>

      {/* --- list reports --- */}
      {reports.map((report) => (
        <div key={report.id} className="mb-8">
          <h3 className="font-semibold text-lg mb-2">
            {report.name} — Type: {report.type}
          </h3>

          {report.type === "HACCP" ? (
            <table className="min-w-full border border-gray-600 text-sm">
              <thead>
                <tr className="bg-gray-200">
                  {[
                    "Process Step",
                    "Food Safety Hazards",
                    "Preventive Controls / Measures",
                    "CCP?",
                    "Critical Limits",
                    "Monitoring",
                    "Corrective Actions",
                    "Verification",
                    "Records",
                  ].map((header) => (
                    <th key={header} className="border border-gray-600 px-2 py-1">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buildHaccpTable(report.stockItems || []).map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td
                        key={j}
                        className="border border-gray-600 px-2 py-1 align-top"
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : report.type === "Cleaning" ? (
            <table className="min-w-full border border-gray-600 text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-600 px-2 py-1">Task</th>
                  <th className="border border-gray-600 px-2 py-1">Frequency</th>
                  <th className="border border-gray-600 px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1">Sanitize surfaces</td>
                  <td className="border px-2 py-1">Daily</td>
                  <td className="border px-2 py-1">Pending</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1">Deep clean fridge</td>
                  <td className="border px-2 py-1">Weekly</td>
                  <td className="border px-2 py-1">Completed</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-gray-600">No structured format for this report type yet.</p>
          )}
        </div>
      ))}

      {/* --- back button --- */}
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