import React, { useState } from "react";
import LoginPage from "./components/LoginPage";
import SitePage from "./components/SitePage";
import HomePage from "./components/HomePage";
import ChecklistSection from "./components/ChecklistSection";
import TempSection from "./components/TempSection";
import CleaningSection from "./components/CleaningSection";
import CookingSection from "./components/CookingSection";

function App() {
  const [user, setUser] = useState(null);
  const [site, setSite] = useState(null);
  const [currentSection, setCurrentSection] = useState(null);
  const [checklists, setChecklists] = useState([]);
  const [completed, setCompleted] = useState([]);

  const resetApp = () => {
    setUser(null);
    setSite(null);
    setCurrentSection(null);
  };

  let content;

  if (!user) content = <LoginPage setUser={setUser} />;
  else if (!site) content = <SitePage setSite={setSite} user={user} />;
  else if (!currentSection)
    content = <HomePage user={user} site={site} onSelectSection={setCurrentSection} resetApp={resetApp} />;
  else {
    switch (currentSection) {
      case "checklist":
        content = (
          <ChecklistSection
            goBack={() => setCurrentSection(null)}
            checklists={checklists}
            setChecklists={setChecklists}
            completed={completed}
            setCompleted={setCompleted}
            site={site}
            user={user}
          />
        );
        break;
      case "temp":
        content = <TempSection goBack={() => setCurrentSection(null)} />;
        break;
      case "cleaning":
        content = <CleaningSection goBack={() => setCurrentSection(null)} />;
        break;
      case "cooking":
        content = <CookingSection goBack={() => setCurrentSection(null)} />;
        break;
      default:
        content = <HomePage user={user} site={site} onSelectSection={setCurrentSection} resetApp={resetApp} />;
        break;
    }
  }

  return <div style={{ minHeight: "100vh", backgroundColor: "#1a4a4c", color: "#fff" }}>{content}</div>;
}

export default App;