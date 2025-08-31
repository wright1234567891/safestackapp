import React, { useState } from "react";
import EquipmentManager from "./EquipmentManager";
import ChecklistSection from "./ChecklistSection";
import TempSection from "./TempSection";
import CleaningSection from "./CleaningSection";
import CookingSection from "./CookingSection";

const sites = [
  "Thorganby Site",
  "Street Food Trailer",
  "Newsholme Site",
  "Pop up Locations",
];

const SitePage = () => {
  const [selectedSite, setSelectedSite] = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  // State for all sections
  const [checklists, setChecklists] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [tempChecks, setTempChecks] = useState([]);
  const [cleaningRecords, setCleaningRecords] = useState([]); // ✅ Firebase-enabled state
  const user = "Chris";

  const resetSite = () => {
    setSelectedSite(null);
    setActiveSection(null);
  };

  // Render sections
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
        user={user} // ✅ Pass user
        cleaningRecords={cleaningRecords} // ✅ Pass records
        setCleaningRecords={setCleaningRecords} // ✅ Pass setter
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

  // Site selection screen
  if (!selectedSite) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <h1>Select Site</h1>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "20px",
            flexWrap: "wrap",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          {sites.map((site) => (
            <button
              key={site}
              onClick={() => setSelectedSite(site)}
              style={{
                padding: "15px 30px",
                fontSize: "18px",
                margin: "10px",
                cursor: "pointer",
                borderRadius: "8px",
                border: "2px solid #333",
                backgroundColor: "#f9f9f9",
                minWidth: "220px",
              }}
            >
              {site}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const buttonStyle = {
    padding: "10px 20px",
    borderRadius: "8px",
    cursor: "pointer",
    minWidth: "160px",
  };

  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h1>{selectedSite}</h1>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "15px",
          flexWrap: "wrap",
          marginTop: "30px",
        }}
      >
        <button style={buttonStyle} onClick={() => setActiveSection("checklists")}>
          Checklists
        </button>
        <button style={buttonStyle} onClick={() => setActiveSection("temp")}>
          Temp Checks
        </button>
        <button style={buttonStyle} onClick={() => setActiveSection("cleaning")}>
          Cleaning
        </button>
        <button style={buttonStyle} onClick={() => setActiveSection("cooking")}>
          Cooking & Cooling
        </button>
        <button
          style={{ ...buttonStyle, backgroundColor: "#d4f1f4" }}
          onClick={() => setActiveSection("equipment")}
        >
          Add Equipment
        </button>
      </div>
      <button
        onClick={resetSite}
        style={{ marginTop: "30px", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}
      >
        Back
      </button>
    </div>
  );
};

export default SitePage;