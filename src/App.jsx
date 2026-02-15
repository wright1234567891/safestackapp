import React, { useState } from "react";
import LoginPage from "./components/LoginPage";
import SitePage from "./components/SitePage";

function App() {
  const [user, setUser] = useState(null);

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#1a4a4c", color: "#fff" }}>
      {!user ? <LoginPage setUser={setUser} /> : <SitePage user={user} onLogout={handleLogout} />}
    </div>
  );
}

export default App;