import React from "react";

const HomePage = ({ user, site, onSelectSection, resetApp }) => {
  return (
    <div style={{ padding: "30px", textAlign: "center" }}>
      <h1>Welcome {user}</h1>
      <h2>Site: {site}</h2>

      <div style={{ margin: "20px 0" }}>
        <button
          onClick={() => onSelectSection("checklist")}
          style={{ padding: "10px 20px", margin: "10px", fontSize: "16px", borderRadius: "8px", cursor: "pointer" }}
        >
          Checklists
        </button>
        <button
          onClick={() => onSelectSection("temp")}
          style={{ padding: "10px 20px", margin: "10px", fontSize: "16px", borderRadius: "8px", cursor: "pointer" }}
        >
          Temp Checks
        </button>
        <button
          onClick={() => onSelectSection("cleaning")}
          style={{ padding: "10px 20px", margin: "10px", fontSize: "16px", borderRadius: "8px", cursor: "pointer" }}
        >
          Cleaning
        </button>
        <button
          onClick={() => onSelectSection("cooking")}
          style={{ padding: "10px 20px", margin: "10px", fontSize: "16px", borderRadius: "8px", cursor: "pointer" }}
        >
          Cooking & Cooling
        </button>
      </div>

      <button
        onClick={resetApp}
        style={{
          marginTop: "30px",
          padding: "10px 20px",
          fontSize: "16px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  );
};

export default HomePage;