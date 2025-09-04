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
import {
  FaFileAlt,
  FaFilter,
  FaPlus,
  FaFileCsv,
  FaFilePdf,
  FaArrowLeft,
  FaClipboardList,
} from "react-icons/fa";

const Reports = ({ site, goBack, user }) => {
  // ========= State =========
  const [reports, setReports] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [haccpPoints, setHaccpPoints] = useState([]);

  const [newReportName, setNewReportName] = useState("");
  const [newReportType, setNewReportType] = useState("HACCP");

  const [filterText, setFilterText] = useState("");
  const [onlyType, setOnlyType] = useState("ALL");

  // keep table DOM refs so we can export edited content, not just generated defaults
  const tableRefs = useRef({});

  // ========= Styles (mirrors StockSection / ChecklistSection) =========
  const wrap = {
    maxWidth: "980px",
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "'Inter', sans-serif",
    color: "#111",
  };

  const headerBar = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
  };

  const title = {
    fontSize: "28px",
    fontWeight: 700,
    margin: 0,
  };

  const subtitle = { fontSize: 13, color: "#6b7280", marginTop: 4 };

  const card = {
    background: "#fff",
    borderRadius: "14px",
    padding: "18px 18px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    marginBottom: "18px",
  };

  const sectionHeader = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontWeight: 700,
    fontSize: "16px",
    marginBottom: "14px",
  };

  const row = {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
  };

  const input = {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    minWidth: "220px",
    background: "#fff",
  };

  const selectInput = { ...input, minWidth: "180px" };

  const button = (bg = "#f3f4f6", fg = "#111") => ({
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    backgroundColor: bg,
    color: fg,
    fontWeight: 600,
    transition: "all .2s",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  });

  const primaryBtn = button("#22c55e", "#fff");
  const blueBtn = button("#2563eb", "#fff");
  const orangeBtn = button("#f97316", "#fff");
  const grayBtn = button();

  const tableWrap = {
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  };

  const table = {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    fontSize: "14px",
  };

  const th = {
    textAlign: "left",
    padding: "10px 12px",
    background: "#111827",
    color: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 1,
    borderBottom: "1px solid #e5e7eb",
    borderRight: "1px solid #374151",
    whiteSpace: "nowrap",
  };

  const td = {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    borderRight: "1px solid #f1f5f9",
    verticalAlign: "top",
  };

  const smallNote = { fontSize: 12, color: "#6b7280" };

  // ========= Data listeners =========
  useEffect(() => {
    if (!site) return;
    const q1 = query(collection(db, "reports"), where("site", "==", site));
    const unsub1 = onSnapshot(q1, (snap) => {
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub1();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const q2 = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub2 = onSnapshot(q2, (snap) => {
      setStockItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub2();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const q3 = query(collection(db, "haccpPoints"), where("site", "==", site));
    const unsub3 = onSnapshot(q3, (snap) => {
      setHaccpPoints(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub3();
  }, [site]);

  // ========= Builders =========
  const buildHaccpRows = (items) => {
    const rows = [];
    items.forEach((item) => {
      const linked =
        item.haccpPoints?.map(
          (id) => haccpPoints.find((hp) => hp.id === id)?.name
        ) || [];
      if (linked.length) {
        linked.forEach((hazard) => {
          rows.push({
            "Process Step": item.name,
            "Food Safety Hazard": hazard,
            "Preventive Controls / Measures": "",
            "CCP?": "Yes",
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
          "CCP?": "No",
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

  // ========= Add Report =========
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

  // ========= Export helpers (read live DOM so edited cells are captured) =========
  const readTableToJSON = (tableEl) => {
    if (!tableEl) return [];
    const headers = Array.from(tableEl.querySelectorAll("thead th")).map((th) =>
      (th.textContent || "").trim()
    );
    const rows = Array.from(tableEl.querySelectorAll("tbody tr"));
    return rows.map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td"));
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (cells[i]?.innerText || "").trim();
      });
      return obj;
    });
  };

  const exportCSV = (reportId, filename) => {
    const tableEl = tableRefs.current[reportId];
    const data = readTableToJSON(tableEl);
    if (!data.length) return;

    const headers = Object.keys(data[0]);
    const escape = (val) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv =
      headers.map(escape).join(",") +
      "\n" +
      data.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");

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

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("l", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pageHeight = pdf.internal.pageSize.getHeight();
    const y = imgHeight < pageHeight ? (pageHeight - imgHeight) / 2 : 0;

    pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
    pdf.save(`${filename}.pdf`);
  };

  // ========= Filters =========
  const filteredReports = useMemo(() => {
    const s = filterText.toLowerCase();
    const byText = (r) =>
      r.name?.toLowerCase().includes(s) || r.type?.toLowerCase().includes(s);
    const byType = onlyType === "ALL" ? () => true : (r) => r.type === onlyType;
    return reports.filter((r) => byText(r) && byType(r));
  }, [reports, filterText, onlyType]);

  // ========= Renderers =========
  const renderHACCP = (report) => {
    const headers = defaultHeadersByType.HACCP;
    const rows = buildHaccpRows(report.stockItems || []);

    return (
      <div style={tableWrap}>
        <div style={{ overflowX: "auto" }}>
          <table
            style={table}
            ref={(el) => (tableRefs.current[report.id] = el)}
          >
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 === 0 ? "#ffffff" : "#fafafa",
                  }}
                >
                  {headers.map((h) => (
                    <td
                      key={h}
                      style={td}
                      contentEditable={
                        h !== "Process Step" && h !== "Food Safety Hazard"
                      }
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
        <div style={{ paddingTop: 8, textAlign: "right" }}>
          <span style={smallNote}>
            Tip: Click any cell (except “Process Step” and “Food Safety
            Hazard”) to edit before exporting.
          </span>
        </div>
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
      <div style={tableWrap}>
        <div style={{ overflowX: "auto" }}>
          <table
            style={table}
            ref={(el) => (tableRefs.current[report.id] = el)}
          >
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 === 0 ? "#ffffff" : "#fafafa",
                  }}
                >
                  {headers.map((h) => (
                    <td key={h} style={td} contentEditable suppressContentEditableWarning>
                      {row[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ paddingTop: 8, textAlign: "right" }}>
          <span style={smallNote}>
            You can edit these cells inline before exporting.
          </span>
        </div>
      </div>
    );
  };

  // ========= JSX =========
  return (
    <div style={wrap}>
      {/* Header */}
      <div style={headerBar}>
        <div>
          <h2 style={title}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <FaClipboardList color="#2563eb" />
              Reports — <span style={{ color: "#2563eb" }}>{site}</span>
            </span>
          </h2>
          <div style={subtitle}>
            Create custom reports and export as CSV or PDF. Edit table cells
            inline before exporting.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={goBack}
            style={grayBtn}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#e5e7eb")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#f3f4f6")
            }
            title="Back"
          >
            <FaArrowLeft />
            Back
          </button>
        </div>
      </div>

      {/* Create report */}
      <div style={card}>
        <div style={sectionHeader}>
          <FaFileAlt />
          Create a report
        </div>
        <div style={row}>
          <input
            type="text"
            placeholder="e.g. Monthly HACCP Review"
            value={newReportName}
            onChange={(e) => setNewReportName(e.target.value)}
            style={{ ...input, flex: 1 }}
          />
          <select
            value={newReportType}
            onChange={(e) => setNewReportType(e.target.value)}
            style={selectInput}
          >
            <option value="HACCP">HACCP</option>
            <option value="Cleaning">Cleaning</option>
            <option value="Other">Other</option>
          </select>
          <button
            onClick={addReport}
            style={primaryBtn}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#16a34a")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#22c55e")
            }
          >
            <FaPlus />
            Add Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={card}>
        <div style={sectionHeader}>
          <FaFilter />
          Filter reports
        </div>
        <div style={row}>
          <input
            type="text"
            placeholder="Search by name or type…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ ...input, flex: 1, minWidth: 260 }}
          />
          <select
            value={onlyType}
            onChange={(e) => setOnlyType(e.target.value)}
            style={selectInput}
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
        <div style={{ ...card, textAlign: "center", color: "#6b7280" }}>
          No reports yet. Create one above.
        </div>
      ) : (
        filteredReports.map((report) => {
          const titleText = `${report.name} — ${report.type}`;
          return (
            <div key={report.id} className="report-card" style={card}>
              <div
                style={{
                  ...row,
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 16 }}>{titleText}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {report.type !== "Other" && (
                    <>
                      <button
                        onClick={() =>
                          exportCSV(report.id, `${report.name}-${report.type}`)
                        }
                        style={blueBtn}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#1d4ed8")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = "#2563eb")
                        }
                        title="Export as CSV"
                      >
                        <FaFileCsv />
                        CSV
                      </button>
                      <button
                        onClick={() =>
                          exportPDF(report.id, `${report.name}-${report.type}`)
                        }
                        style={orangeBtn}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#ea580c")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = "#f97316")
                        }
                        title="Export as PDF"
                      >
                        <FaFilePdf />
                        PDF
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
                <p style={{ color: "#6b7280", margin: 0 }}>
                  No structured format for this report type yet.
                </p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default Reports;