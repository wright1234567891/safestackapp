// src/components/Reports.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const Reports = ({ site, goBack, user }) => {
  const [reports, setReports] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [haccpPoints, setHaccpPoints] = useState([]);

  const [newReportName, setNewReportName] = useState("");
  const [newReportType, setNewReportType] = useState("HACCP");

  // local UI helpers
  const [filterText, setFilterText] = useState("");
  const [onlyType, setOnlyType] = useState("ALL");

  // keep table DOM refs so we can export edited content, not just generated defaults
  const tableRefs = useRef({});

  // ---------------------------
  // Firestore listeners
  // ---------------------------
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "reports"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setStockItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "haccpPoints"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setHaccpPoints(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // ---------------------------
  // Builders
  // ---------------------------
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
            "CCP?": "Yes",
            "Critical Limits": "",
            "Monitoring": "",
            "Corrective Actions": "",
            "Verification": "",
            "Records": "",
          });
        });
      } else {
        rows.push({
          "Process Step": item.name,
          "Food Safety Hazard": "No hazards linked",
          "Preventive Controls / Measures": "",
          "CCP?": "No",
          "Critical Limits": "",
          "Monitoring": "",
          "Corrective Actions": "",
          "Verification": "",
          "Records": "",
        });
      }
    });
    return rows;
  };

  const defaultHeadersByType = {
    HACCP: [
      "Process Step",
      "Food Safety Hazard",
      "Preventive Controls / Measures",
      "CCP?",
      "Critical Limits",
      "Monitoring",
      "Corrective Actions",
      "Verification",
      "Records",
    ],
    Cleaning: ["Task", "Frequency", "Status"],
  };

  // ---------------------------
  // Add report
  // ---------------------------
  const addReport = async () => {
    if (!newReportName.trim()) return;

    let stockData = [];
    if (newReportType === "HACCP") {
      stockData = stockItems.map((item) => ({
        id: item.id,
        name: item.name,
        haccpPoints: item.haccpPoints || [],
      }));
    }

    await addDoc(collection(db, "reports"), {
      name: newReportName.trim(),
      type: newReportType,
      site,
      stockItems: stockData,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });

    setNewReportName("");
    setNewReportType("HACCP");
  };

  // ---------------------------
  // Exports (read the DOM so edited cells are included)
  // ---------------------------
  const readTableToJSON = (table) => {
    if (!table) return [];
    const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
      (th.textContent || "").trim()
    );

    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    return bodyRows.map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td"));
      const obj = {};
      headers.forEach((h, i) => {
        // innerText to capture contentEditable text
        obj[h] = (cells[i]?.innerText || "").trim();
      });
      return obj;
    });
  };

  const exportCSV = (reportId, filename) => {
    const table = tableRefs.current[reportId];
    const data = readTableToJSON(table);
    if (!data.length) return;

    const headers = Object.keys(data[0]);
    const escape = (val) => {
      const s = String(val ?? "");
      // escape quotes/delimiters/newlines
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csv =
      headers.map(escape).join(",") +
      "\n" +
      data.map((row) => headers.map((h) => escape(row[h])).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async (reportId, filename) => {
    const container = tableRefs.current[reportId]?.closest?.(".report-card");
    if (!container) return;

    // widen for better capture
    const scale = 2;
    const canvas = await html2canvas(container, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("l", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    if (imgHeight < pageHeight) {
      // center vertically on single page
      y = (pageHeight - imgHeight) / 2;
    }

    pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
    pdf.save(`${filename}.pdf`);
  };

  // ---------------------------
  // Filters
  // ---------------------------
  const filteredReports = useMemo(() => {
    const byText = (r) =>
      r.name?.toLowerCase().includes(filterText.toLowerCase()) ||
      r.type?.toLowerCase().includes(filterText.toLowerCase());

    const byType =
      onlyType === "ALL" ? () => true : (r) => r.type === onlyType;

    return reports.filter((r) => byText(r) && byType(r));
  }, [reports, filterText, onlyType]);

  // ---------------------------
  // Renderers
  // ---------------------------
  const renderHACCP = (report) => {
    const headers = defaultHeadersByType.HACCP;
    const rows = buildHaccpRows(report.stockItems || []);

    return (
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table
          className="min-w-full text-sm"
          ref={(el) => (tableRefs.current[report.id] = el)}
        >
          <thead>
            <tr className="bg-gray-800 text-white">
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 text-left border border-gray-200">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                {headers.map((h) => (
                  <td
                    key={h}
                    className="px-3 py-2 align-top border border-gray-200"
                    contentEditable={h !== "Process Step" && h !== "Food Safety Hazard"}
                    suppressContentEditableWarning
                  >
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCleaning = (report) => {
    const headers = defaultHeadersByType.Cleaning;
    const rows = [
      { Task: "Sanitize surfaces", Frequency: "Daily", Status: "Pending" },
      { Task: "Deep clean fridge", Frequency: "Weekly", Status: "Completed" },
    ];

    return (
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table
          className="min-w-full text-sm"
          ref={(el) => (tableRefs.current[report.id] = el)}
        >
          <thead>
            <tr className="bg-gray-800 text-white">
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 text-left border border-gray-200">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                {headers.map((h) => (
                  <td
                    key={h}
                    className="px-3 py-2 align-top border border-gray-200"
                    contentEditable
                    suppressContentEditableWarning
                  >
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ---------------------------
  // JSX
  // ---------------------------
  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Reports — {site}
            </h2>
            <p className="text-gray-500 text-sm">
              Create custom reports and export as CSV or PDF. You can edit the
              table cells before exporting.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={goBack}
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded"
            >
              Back
            </button>
          </div>
        </div>

        {/* Create report */}
        <div className="rounded-xl bg-white shadow p-3 sm:p-4 mb-5">
          <div className="flex flex-col md:flex-row gap-2 md:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report name
              </label>
              <input
                type="text"
                placeholder="e.g. Monthly HACCP Review"
                value={newReportName}
                onChange={(e) => setNewReportName(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>
            <div className="md:w-56">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={newReportType}
                onChange={(e) => setNewReportType(e.target.value)}
                className="border p-2 rounded w-full"
              >
                <option value="HACCP">HACCP</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <button
              onClick={addReport}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Add Report
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl bg-white shadow p-3 sm:p-4 mb-5">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <input
              type="text"
              placeholder="Search by name or type…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="border p-2 rounded flex-1"
            />
            <select
              value={onlyType}
              onChange={(e) => setOnlyType(e.target.value)}
              className="border p-2 rounded md:w-56"
            >
              <option value="ALL">All types</option>
              <option value="HACCP">HACCP</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Reports list */}
        {filteredReports.length === 0 ? (
          <div className="text-gray-500 text-center py-10">
            No reports yet. Create one above.
          </div>
        ) : (
          filteredReports.map((report) => {
            const title = `${report.name} — ${report.type}`;

            return (
              <div
                key={report.id}
                className="report-card rounded-xl bg-white shadow p-3 sm:p-4 mb-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <div className="font-semibold text-lg text-gray-900">
                    {title}
                  </div>
                  <div className="flex gap-2">
                    {report.type !== "Other" && (
                      <>
                        <button
                          onClick={() =>
                            exportCSV(report.id, `${report.name}-${report.type}`)
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
                        >
                          Export CSV
                        </button>
                        <button
                          onClick={() =>
                            exportPDF(report.id, `${report.name}-${report.type}`)
                          }
                          className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded text-sm"
                        >
                          Export PDF
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {report.type === "HACCP" ? (
                  renderHACCP(report)
                ) : report.type === "Cleaning" ? (
                  renderCleaning(report)
                ) : (
                  <p className="text-gray-600">
                    No structured format for this report type yet.
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Reports;