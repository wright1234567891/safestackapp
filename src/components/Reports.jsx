import React, { useState } from "react";

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState("");

  const handleAddReport = () => {
    if (!selectedReport) return;

    const newReport = {
      id: Date.now(),
      type: selectedReport,
    };

    setReports([...reports, newReport]);
    setSelectedReport("");
  };

  const renderReport = (report) => {
    switch (report.type) {
      case "HACCP":
        return (
          <table
            className="border-collapse border border-gray-600 w-full mt-2 text-sm"
          >
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-600 px-2 py-1 text-left">Step</th>
                <th className="border border-gray-600 px-2 py-1 text-left">Hazard</th>
                <th className="border border-gray-600 px-2 py-1 text-left">Control Measure</th>
                <th className="border border-gray-600 px-2 py-1 text-left">Monitoring</th>
                <th className="border border-gray-600 px-2 py-1 text-left">Corrective Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-600 px-2 py-1">Storage</td>
                <td className="border border-gray-600 px-2 py-1">Bacterial growth</td>
                <td className="border border-gray-600 px-2 py-1">Keep ≤ 5°C</td>
                <td className="border border-gray-600 px-2 py-1">Daily temp log</td>
                <td className="border border-gray-600 px-2 py-1">Discard food if unsafe</td>
              </tr>
              <tr>
                <td className="border border-gray-600 px-2 py-1">Cooking</td>
                <td className="border border-gray-600 px-2 py-1">Undercooking</td>
                <td className="border border-gray-600 px-2 py-1">Cook ≥ 75°C</td>
                <td className="border border-gray-600 px-2 py-1">Check with probe</td>
                <td className="border border-gray-600 px-2 py-1">Continue cooking</td>
              </tr>
            </tbody>
          </table>
        );
      case "Cleaning":
        return (
          <div className="p-2 border border-gray-600 mt-2">
            <h3 className="font-semibold">Cleaning Report</h3>
            <p>Checklist of areas to clean, responsible staff, and sign-off.</p>
          </div>
        );
      default:
        return (
          <div className="p-2 border border-gray-600 mt-2">
            <p>{report.type} Report</p>
          </div>
        );
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Reports</h2>

      <div className="flex gap-2 mb-4">
        <select
          value={selectedReport}
          onChange={(e) => setSelectedReport(e.target.value)}
          className="border border-gray-600 rounded p-2"
        >
          <option value="">Select report type</option>
          <option value="HACCP">HACCP Report</option>
          <option value="Cleaning">Cleaning Report</option>
          <option value="Temperature">Temperature Report</option>
        </select>
        <button
          onClick={handleAddReport}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add Report
        </button>
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <div key={report.id}>{renderReport(report)}</div>
        ))}
      </div>
    </div>
  );
};

export default Reports;