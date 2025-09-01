// src/components/SitePage.jsx
import React, { useState } from "react";
import { FaClipboardList, FaThermometerHalf, FaBroom, FaFire, FaBoxOpen, FaChartLine, FaShieldAlt, FaTools } from "react-icons/fa";
import EquipmentManager from "./EquipmentManager";
import ChecklistSection from "./ChecklistSection";
import TempSection from "./TempSection";
import CleaningSection from "./CleaningSection";
import CookingSection from "./CookingSection";
import StockSection from "./StockSection";
import Reports from "./Reports";
import CCPSection from "./CCPSection";

const sites = [
  "Thorganby Site",
  "Street Food Trailer",
  "Newsholme Site",
  "Pop up Locations",
];

const sections = [
  { key: "checklists", label: "Checklists", icon: <FaClipboardList />, color: "#3b82f6" },
  { key: "temp", label: "Temp Checks", icon: <FaThermometerHalf />, color: "#06b6d4" },
  { key: "cleaning", label: "Cleaning", icon: <FaBroom />, color: "#22c55e" },
  { key: "cooking", label: "Cooking & Cooling", icon: <FaFire />, color: "#f97316" },
  { key: "stock", label: "Stock", icon: <FaBoxOpen />, color: "#8b5cf6" },
  { key: "reports", label: "Reports", icon: <FaChartLine />, color: "#64748b" },
  { key: "ccp", label: "CCPs", icon: <FaShieldAlt />, color: "#ef4444" },
  { key: "equipment", label: "Add Equipment", icon: <FaTools />, color: "#14b8a6" },
];

const SitePage = ({ user, onLogout }) => {
  const [selectedSite, setSelectedSite] = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  const [checklists, setChecklists] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [tempChecks, setTempChecks] = useState([]);
  const [cleaningRecords, setCleaningRecords] = useState([]);

  const resetSite = () => {
    setSelectedSite(null);
    setActiveSection(null);
  };

  // Section rendering
  if (selectedSite && activeSection === "equipment") {
    return (
      <EquipmentManager
        goBack={() => setActiveSection(null)}
        tempChecks={tempChecks}
        setTempChecks={setTempChecks}
        site={selectedSite}
        user={user}
      />
    );
  }

  if (selectedSite && activeSection === "checklists") {
    return (
      <ChecklistSection
        goBack={() => setActiveSection(null)}
        checklists={checklists}
        setChecklists={setChecklists}
        completed={completed}
        setCompleted={setCompleted}
        site={selectedSite}
        user={user}
      />
    );
  }

  if (selectedSite && activeSection === "temp") {
    const siteTempChecks = tempChecks.filter(
      (e) => e.site === selectedSite && (e.type === "Fridge" || e.type === "Freezer")
    );

    return (
      <TempSection
        goBack={() => setActiveSection(null)}
        tempChecks={siteTempChecks}
        setTempChecks={setTempChecks}
        site={selectedSite}
        user={user}
      />
    );
  }

  if (selectedSite && activeSection === "cleaning") {
    return (
      <CleaningSection
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
        cleaningRecords={cleaningRecords}
        setCleaningRecords={setCleaningRecords}
      />
    );
  }

  if (selectedSite && activeSection === "cooking") {
    const cookingEquipment = tempChecks.filter(
      (e) => e.site === selectedSite && e.type === "Cooking"
    );

    return (
      <CookingSection
        goBack={() => setActiveSection(null)}
        cookingEquipment={cookingEquipment}
        setTempChecks={setTempChecks}
        site={selectedSite}
        user={user}
      />
    );
  }

  if (selectedSite && activeSection === "stock") {
    return (
      <StockSection
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
      />
    );
  }

  if (selectedSite && activeSection === "reports") {
    return (
      <Reports
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
      />
    );
  }

  if (selectedSite && activeSection === "ccp") {
    return (
      <CCPSection
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
      />
    );
  }

  // Site selection screen
  if (!selectedSite) {
    return (
      <div className="container">
        <h1 style={{ marginBottom: "30px" }}>Select Site</h1>
        <div className="grid" style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "center" }}>
          {sites.map((site) => (
            <div
              key={site}
              onClick={() => setSelectedSite(site)}
              style={{
                backgroundColor: "#f0f4f8",
                padding: "25px 35px",
                minWidth: "220px",
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: 600,
                textAlign: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-3px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
            >
              {site}
            </div>
          ))}
        </div>

        <button
          onClick={onLogout}
          style={{
            marginTop: "40px",
            padding: "12px 24px",
            borderRadius: "10px",
            cursor: "pointer",
            backgroundColor: "#ffb3b3",
            fontSize: "16px",
            border: "none",
          }}
        >
          Logout
        </button>
      </div>
    );
  }

  // Selected site dashboard
  return (
    <div className="container">
      <h1 style={{ marginBottom: "30px" }}>{selectedSite}</h1>
      <div className="grid" style={{ display: "flex", flexWrap: "wrap", gap: "20px", justifyContent: "center" }}>
        {sections.map((sec) => (
          <div
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            style={{
              backgroundColor: sec.color,
              color: "#fff",
              minWidth: "180px",
              padding: "20px",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 3px 8px rgba(0,0,0,0.15)",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-3px)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
          >
            <div style={{ fontSize: "24px", marginBottom: "10px" }}>{sec.icon}</div>
            {sec.label}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "40px", display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={resetSite}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            backgroundColor: "#e5e7eb",
            border: "none",
            fontWeight: 600,
          }}
        >
          Back
        </button>

        <button
          onClick={onLogout}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            backgroundColor: "#ffb3b3",
            border: "none",
            fontWeight: 600,
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default SitePage;