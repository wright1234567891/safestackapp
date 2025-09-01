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

  // fetch reports
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "reports"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // fetch stock items
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setStockItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // fetch HACCP points
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "haccpPoints"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setHaccpPoints(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // add new report
  const addReport = async () => {
    if (!newReportName) return;

    let stockData = [];
    if (newReportType === "HACCP") {
      stockData = stockItems.map((item) => ({
        id: item.id,
        name: item.name,
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

  // build HACCP table rows
  const buildHaccpRows = (items) => {
    const rows = [];
    items.forEach((item) => {
      const linked = item.haccpPoints?.map(
        (id) => haccpPoints.find((hp) => hp.id === id)?.name
      );
      if (linked?.length) {
        linked.forEach((hazard) => {
          rows.push({
            "Process Step": item.name,
            "Food Safety Hazard": hazard,
            "Preventive Controls / Measures": "",
            CCP: "Yes",
            "Critical Limits": "",
            Monitoring: "",
            "Corrective Actions": "",
            Verification: "",
            Records: "",
          });
        });
      } else {
        rows.push({
          "Process Step": item.name,
          "Food Safety Hazard": "No hazards linked",
          "Preventive Controls / Measures": "",
          CCP: "No",
          "Critical Limits": "",
          Monitoring: "",
          "Corrective Actions": "",
          Verification: "",
          Records: "",
        });
      }
    });
    return rows;
  };

  return (
    <div className="p-4 bg-white shadow rounded-xl">
      <h2 className="text-xl font-bold mb-4">Reports — {site}</h2>

      {/* add report form */}
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

      {/* list reports */}
      {reports.map((report) => (
        <div key={report.id} className="mb-8">
          <h3 className="font-semibold text-lg mb-2">
            {report.name} — Type: {report.type}
          </h3>

          {report.type === "HACCP" ? (
            <table className="min-w-full border border-white border-collapse text-sm">
              <thead>
                <tr className="bg-gray-800 text-white">
                  {[
                    "Process Step",
                    "Food Safety Hazard",
                    "Preventive Controls / Measures",
                    "CCP?",
                    "Critical Limits",
                    "Monitoring",
                    "Corrective Actions",
                    "Verification",
                    "Records",
                  ].map((header) => (
                    <th
                      key={header}
                      className="border border-white px-2 py-1 text-left"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buildHaccpRows(report.stockItems || []).map((row, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}
                  >
                    {Object.entries(row).map(([key, val]) => (
                      <td
                        key={key}
                        className="border border-white px-2 py-1 align-top"
                        contentEditable={
                          key !== "Process Step" && key !== "Food Safety Hazard"
                        }
                        suppressContentEditableWarning={true}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : report.type === "Cleaning" ? (
            <table className="min-w-full border border-white border-collapse text-sm">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="border border-white px-2 py-1">Task</th>
                  <th className="border border-white px-2 py-1">Frequency</th>
                  <th className="border border-white px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {["Sanitize surfaces", "Deep clean fridge"].map((task, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}
                  >
                    <td className="border border-white px-2 py-1">{task}</td>
                    <td className="border border-white px-2 py-1">
                      {i === 0 ? "Daily" : "Weekly"}
                    </td>
                    <td className="border border-white px-2 py-1">
                      {i === 0 ? "Pending" : "Completed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-600">
              No structured format for this report type yet.
            </p>
          )}
        </div>
      ))}

      {/* back button */}
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