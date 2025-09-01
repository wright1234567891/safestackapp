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
      <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "'Inter', sans-serif" }}>
        <h1 style={{ marginBottom: "40px", fontSize: "34px", color: "#111", fontWeight: 600 }}>Select Site</h1>
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
                padding: "22px 36px",
                fontSize: "18px",
                margin: "10px",
                cursor: "pointer",
                borderRadius: "14px",
                border: "1px solid #ddd",
                backgroundColor: "#fff",
                minWidth: "220px",
                fontWeight: 500,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                transition: "all 0.25s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.12)";
                e.currentTarget.style.backgroundColor = "#f0f4f8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                e.currentTarget.style.backgroundColor = "#fff";
              }}
            >
              {site}
            </button>
          ))}
        </div>

        <button
          onClick={onLogout}
          style={{
            marginTop: "50px",
            padding: "14px 28px",
            borderRadius: "12px",
            cursor: "pointer",
            backgroundColor: "#ff5f5f",
            fontSize: "16px",
            color: "#fff",
            border: "none",
            fontWeight: 500,
            transition: "all 0.25s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#ff3f3f"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ff5f5f"}
        >
          Logout
        </button>
      </div>
    );
  }

  const buttonStyle = {
    padding: "14px 28px",
    borderRadius: "12px",
    cursor: "pointer",
    minWidth: "160px",
    fontWeight: 500,
    fontSize: "15px",
    transition: "all 0.25s",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    border: "none",
    backgroundColor: "#f3f4f6",
    color: "#111",
  };

  return (
    <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "'Inter', sans-serif" }}>
      <h1 style={{ fontSize: "30px", marginBottom: "35px", color: "#111", fontWeight: 600 }}>{selectedSite}</h1>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginTop: "20px",
        }}
      >
        {[
          { label: "Checklists", key: "checklists" },
          { label: "Temp Checks", key: "temp" },
          { label: "Cleaning", key: "cleaning" },
          { label: "Cooking & Cooling", key: "cooking" },
          { label: "Stock", key: "stock" },
          { label: "Reports", key: "reports" },
          { label: "CCPs", key: "ccp" },
          { label: "Add Equipment", key: "equipment" },
        ].map((sec) => (
          <button
            key={sec.key}
            style={{
              ...buttonStyle,
              backgroundColor: "#fff",
              minWidth: "180px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#eef2f7";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fff";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
            }}
            onClick={() => setActiveSection(sec.key)}
          >
            {sec.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: "40px", display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={resetSite}
          style={buttonStyle}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#e0e3e8"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#f3f4f6"}
        >
          Back
        </button>
        <button
          onClick={onLogout}
          style={{ ...buttonStyle, backgroundColor: "#ff5f5f", color: "#fff" }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#ff3f3f"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ff5f5f"}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default SitePage;