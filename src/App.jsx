import React, { useState } from "react";
import LoginPage from "./components/LoginPage";
import SitePage from "./components/SitePage";

function App() {
  const [user, setUserState] = useState(() => {
    const savedUser = localStorage.getItem("safestackUser");

    if (!savedUser) return null;

    try {
      return JSON.parse(savedUser);
    } catch {
      return null;
    }
  });

  const setUser = (nextUser) => {
    setUserState(nextUser);

    localStorage.setItem(
      "safestackUser",
      JSON.stringify(nextUser)
    );
  };

  const handleLogout = () => {
    setUserState(null);
    localStorage.removeItem("safestackUser");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1a4a4c",
        color: "#fff",
      }}
    >
      {!user ? (
        <LoginPage setUser={setUser} />
      ) : (
        <SitePage
          user={user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;