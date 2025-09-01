// src/components/SitePage.jsx
import React, { useState } from "react";
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
      <div style={{ textAlign: "center", padding: "50px" }}>
        <h1 style={{ marginBottom: "30px", fontSize: "32px", color: "#333" }}>Select Site</h1>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "20px",
            flexWrap: "wrap",
            maxWidth: "700px",
            margin: "0 auto",
          }}
        >
          {sites.map((site) => (
            <button
              key={site}
              onClick={() => setSelectedSite(site)}
              style={{
                padding: "20px 35px",
                fontSize: "18px",
                margin: "10px",
                cursor: "pointer",
                borderRadius: "12px",
                border: "2px solid #ccc",
                backgroundColor: "#f9f9f9",
                minWidth: "220px",
                fontWeight: 600,
                boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 6px 15px rgba(0,0,0,0.15)";
                e.currentTarget.style.backgroundColor = "#eef6ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)";
                e.currentTarget.style.backgroundColor = "#f9f9f9";
              }}
            >
              {site}
            </button>
          ))}
        </div>

        <button
          onClick={onLogout}
          style={{
            marginTop: "40px",
            padding: "12px 24px",
            borderRadius: "10px",
            cursor: "pointer",
            backgroundColor: "#ff6b6b",
            fontSize: "16px",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#ff4b4b"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ff6b6b"}
        >
          Logout
        </button>
      </div>
    );
  }

  const buttonStyle = {
    padding: "12px 22px",
    borderRadius: "8px",
    cursor: "pointer",
    minWidth: "160px",
    fontWeight: 600,
    transition: "all 0.2s",
  };

  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h1 style={{ fontSize: "28px", marginBottom: "30px", color: "#333" }}>{selectedSite}</h1>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "18px",
          flexWrap: "wrap",
          marginTop: "30px",
        }}
      >
        <button
          style={{ ...buttonStyle, backgroundColor: "#3b82f6", color: "#fff" }}
          onClick={() => setActiveSection("checklists")}
        >
          Checklists
        </button>
        <button
          style={{ ...buttonStyle, backgroundColor: "#06b6d4", color: "#fff" }}
          onClick={() => setActiveSection("temp")}
        >
          Temp Checks
        </button>
        <button
          style={{ ...buttonStyle, backgroundColor: "#22c55e", color: "#fff" }}
          onClick={() => setActiveSection("cleaning")}
        >
          Cleaning
        </button>
        <button
          style={{ ...buttonStyle, backgroundColor: "#f97316", color: "#fff" }}
          onClick={() => setActiveSection("cooking")}
        >
          Cooking & Cooling
        </button>
        <button
          style={{ ...buttonStyle, backgroundColor: "#8b5cf6", color: "#fff" }}
          onClick={() => setActiveSection("stock")}
        >
          Stock
        </button>
        <button
          style={{ ...buttonStyle, backgroundColor: "#64748b", color: "#fff" }}
          onClick={() => setActiveSection("reports")}
        >
          Reports
        </button>
        <button
          style={{ ...buttonStyle, backgroundColor: "#ef4444", color: "#fff" }}
          onClick={() => setActiveSection("ccp")}
        >
          CCPs
        </button>
        <button
          style={{ ...buttonStyle, backgroundColor: "#14b8a6", color: "#fff" }}
          onClick={() => setActiveSection("equipment")}
        >
          Add Equipment
        </button>
      </div>

      <div style={{ marginTop: "40px", display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={resetSite}
          style={{ ...buttonStyle, backgroundColor: "#e5e7eb", border: "none" }}
        >
          Back
        </button>
        <button
          onClick={onLogout}
          style={{ ...buttonStyle, backgroundColor: "#ff6b6b", color: "#fff", border: "none" }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#ff4b4b"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ff6b6b"}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default SitePage;