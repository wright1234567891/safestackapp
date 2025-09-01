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

  // --- table schemas per report type ---
  const reportSchemas = {
    HACCP: {
      headers: ["Item", "Quantity", "Measurement", "Linked CCPs"],
      buildData: (items) =>
        items.map((item) => ({
          Item: item.name,
          Quantity: item.quantity,
          Measurement: item.measurement,
          "Linked CCPs": item.haccpPoints?.length
            ? item.haccpPoints
                .map((id) => haccpPoints.find((hp) => hp.id === id)?.name)
                .join(", ")
            : "N/A",
        })),
    },
    Cleaning: {
      headers: ["Task", "Frequency", "Status"],
      buildData: () => [
        { Task: "Sanitize surfaces", Frequency: "Daily", Status: "Pending" },
        { Task: "Deep clean fridge", Frequency: "Weekly", Status: "Completed" },
      ],
    },
    Other: {
      headers: ["Note"],
      buildData: () => [{ Note: "Generic report type, no structure yet." }],
    },
  };

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
      {reports.map((report) => {
        const schema = reportSchemas[report.type];
        if (!schema) return null;

        const data = schema.buildData(report.stockItems || []);

        return (
          <div key={report.id} className="mb-6">
            <h3 className="font-semibold text-lg mb-2">
              {report.name} — Type: {report.type}
            </h3>

            <table className="min-w-full border border-gray-300">
              <thead>
                <tr className="bg-gray-200">
                  {schema.headers.map((header) => (
                    <th key={header} className="border px-4 py-2 text-left">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i}>
                    {schema.headers.map((header) => (
                      <td key={header} className="border px-4 py-2">
                        {row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

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