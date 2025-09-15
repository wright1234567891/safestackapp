// src/components/SitePage.jsx
import React, { useState } from "react";
import {
  FaMapMarkerAlt,
  FaChevronRight,
  FaPlus,
  FaClipboardCheck,
  FaThermometerHalf,
  FaBroom,
  FaDrumstickBite,
  FaBoxes,
  FaChartBar,
  FaExclamationTriangle,
  FaTools,
  FaUtensils, // ✅ added
  FaUserGraduate, // ✅ NEW (for Staff Training)
} from "react-icons/fa";
import EquipmentManager from "./EquipmentManager";
import ChecklistSection from "./ChecklistSection";
import TempSection from "./TempSection";
import CleaningSection from "./CleaningSection";
import CookingSection from "./CookingSection";
import StockSection from "./StockSection";
import Reports from "./Reports";
import CCPSection from "./CCPSection";
import HaccpDashboard from "./HaccpDashboard"; // ✅ NEW
import DishesSection from "./DishesSection";   // ✅ added
import StaffTrainingSection from "./StaffTrainingSection"; // ✅ NEW

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
      (e) =>
        e.site === selectedSite &&
        (e.type === "Fridge" || e.type === "Freezer")
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
  // ✅ NEW: HACCP Dashboard route
  if (selectedSite && activeSection === "haccpDashboard") {
    return (
      <HaccpDashboard
        goBack={() => setActiveSection(null)}
        site={selectedSite}
      />
    );
  }
  // ✅ NEW: Dishes route
  if (selectedSite && activeSection === "dishes") {
    return (
      <DishesSection
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
      />
    );
  }
  // ✅ NEW: Staff Training route
  if (selectedSite && activeSection === "training") {
    return (
      <StaffTrainingSection
        goBack={() => setActiveSection(null)}
        site={selectedSite}
        user={user}
      />
    );
  }

  // Site selection screen
  if (!selectedSite) {
    return (
      <div
        style={{
          maxWidth: "500px",
          margin: "0 auto",
          padding: "40px 20px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <h1
          style={{
            fontSize: "30px",
            fontWeight: "700",
            marginBottom: "25px",
            color: "#111",
            textAlign: "center",
          }}
        >
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
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#f9fafb")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#fff")
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <FaMapMarkerAlt size={20} color="#ef4444" />
                <div>
                  <div
                    style={{
                      fontWeight: "600",
                      fontSize: "16px",
                      color: "#111",
                    }}
                  >
                    {site}
                  </div>
                  <div style={{ fontSize: "13px", color: "#666" }}>
                    Tap to enter venue
                  </div>
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
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#f9fafb")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#fff")
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <FaPlus size={18} color="#555" />
              <div
                style={{
                  fontWeight: "600",
                  fontSize: "16px",
                  color: "#111",
                }}
              >
                Set up a new venue
              </div>
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
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#ff3f3f")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#ff5f5f")
          }
        >
          Logout
        </button>
      </div>
    );
  }

  // Dashboard with icon cards
  const sections = [
    {
      label: "Checklists",
      key: "checklists",
      icon: <FaClipboardCheck size={24} color="#2563eb" />,
    },
    {
      label: "Temp Checks",
      key: "temp",
      icon: <FaThermometerHalf size={24} color="#ef4444" />,
    },
    {
      label: "Cleaning",
      key: "cleaning",
      icon: <FaBroom size={24} color="#10b981" />,
    },
    {
      label: "Cooking & Cooling",
      key: "cooking",
      icon: <FaDrumstickBite size={24} color="#f59e0b" />,
    },
    {
      label: "Stock",
      key: "stock",
      icon: <FaBoxes size={24} color="#6366f1" />,
    },
    {
      label: "Reports",
      key: "reports",
      icon: <FaChartBar size={24} color="#9333ea" />,
    },
    // ✅ NEW: Dishes (recipes) card
    {
      label: "Dishes",
      key: "dishes",
      icon: <FaUtensils size={24} color="#0ea5e9" />,
    },
    // ✅ NEW: Staff Training card
    {
      label: "Staff Training",
      key: "training",
      icon: <FaUserGraduate size={24} color="#0ea5e9" />,
    },
    // ✅ NEW: HACCP Dashboard (read-only live status)
    {
      label: "HACCP Dashboard",
      key: "haccpDashboard",
      icon: <FaExclamationTriangle size={24} color="#16a34a" />,
    },
    // Existing CCP manager (add/edit CCPs)
    {
      label: "CCPs",
      key: "ccp",
      icon: <FaExclamationTriangle size={24} color="#dc2626" />,
    },
    {
      label: "Add Equipment",
      key: "equipment",
      icon: <FaTools size={24} color="#374151" />,
    },
  ];

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "30px",
          marginBottom: "30px",
          color: "#111",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {selectedSite}
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "20px",
        }}
      >
        {sections.map((sec) => (
          <div
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            style={{
              background: "#fff",
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow =
                "0 6px 12px rgba(0,0,0,0.12)";
              e.currentTarget.style.backgroundColor = "#f9fafb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 2px 6px rgba(0,0,0,0.08)";
              e.currentTarget.style.backgroundColor = "#fff";
            }}
          >
            <div style={{ marginBottom: "10px" }}>{sec.icon}</div>
            <div
              style={{
                fontWeight: "600",
                fontSize: "15px",
                color: "#111",
                textAlign: "center",
              }}
            >
              {sec.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "40px",
          display: "flex",
          gap: "16px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={resetSite}
          style={{
            padding: "12px 24px",
            borderRadius: "10px",
            cursor: "pointer",
            backgroundColor: "#f3f4f6",
            fontSize: "15px",
            fontWeight: 500,
            border: "none",
            transition: "all 0.25s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#e0e3e8")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#f3f4f6")
          }
        >
          Back
        </button>
        <button
          onClick={onLogout}
          style={{
            padding: "12px 24px",
            borderRadius: "10px",
            cursor: "pointer",
            backgroundColor: "#ff5f5f",
            fontSize: "15px",
            color: "#fff",
            fontWeight: 500,
            border: "none",
            transition: "all 0.25s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#ff3f3f")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#ff5f5f")
          }
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default SitePage;