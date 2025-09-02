// src/components/SitePage.jsx
import React, { useState } from "react";
import { FaMapMarkerAlt, FaChevronRight, FaPlus } from "react-icons/fa";
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

  // Section rendering stays unchanged
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
      <StockSection goBack={() => setActiveSection(null)} site={selectedSite} user={user} />
    );
  }

  if (selectedSite && activeSection === "reports") {
    return (
      <Reports goBack={() => setActiveSection(null)} site={selectedSite} user={user} />
    );
  }

  if (selectedSite && activeSection === "ccp") {
    return (
      <CCPSection goBack={() => setActiveSection(null)} site={selectedSite} user={user} />
    );
  }

  // Site selection screen (🔽 updated to match screenshot style)
  if (!selectedSite) {
    return (
      <div style={{ maxWidth: "500px", margin: "0 auto", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
        <h1 style={{ fontSize: "30px", fontWeight: "700", marginBottom: "25px", color: "#111", textAlign: "center" }}>
          Venues
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {sites.map((site) => (
            <div
              key={site}
              onClick={() => setSelectedSite(site)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#fff",
                borderRadius: "12px",
                padding: "16px 20px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <FaMapMarkerAlt size={20} color="#ef4444" />
                <div>
                  <div style={{ fontWeight: "600", fontSize: "16px", color: "#111" }}>
                    {site}
                  </div>
                  <div style={{ fontSize: "13px", color: "#666" }}>Tap to enter venue</div>
                </div>
              </div>
              <FaChevronRight size={16} color="#999" />
            </div>
          ))}

          <div
            onClick={() => alert("Setup new venue flow coming soon")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#fff",
              borderRadius: "12px",
              padding: "16px 20px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <FaPlus size={18} color="#555" />
              <div style={{ fontWeight: "600", fontSize: "16px", color: "#111" }}>Set up a new venue</div>
            </div>
            <FaChevronRight size={16} color="#999" />
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            marginTop: "30px",
            width: "100%",
            padding: "12px 20px",
            borderRadius: "10px",
            cursor: "pointer",
            backgroundColor: "#ff5f5f",
            fontSize: "16px",
            color: "#fff",
            border: "none",
            fontWeight: "600",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ff3f3f")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ff5f5f")}
        >
          Logout
        </button>
      </div>
    );
  }

  // --- Dashboard (unchanged) ---
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
      <h1 style={{ fontSize: "30px", marginBottom: "35px", color: "#111", fontWeight: 600 }}>
        {selectedSite}
      </h1>
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
            style={{ ...buttonStyle, backgroundColor: "#fff", minWidth: "180px" }}
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
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e0e3e8")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
        >
          Back
        </button>
        <button
          onClick={onLogout}
          style={{ ...buttonStyle, backgroundColor: "#ff5f5f", color: "#fff" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ff3f3f")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ff5f5f")}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default SitePage;