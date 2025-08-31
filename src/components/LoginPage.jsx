import React, { useState } from "react";

const users = [
  { name: "Chris", role: "Manager" },
  { name: "Chloe", role: "Manager" },
];

const LoginPage = ({ setUser }) => {
  const [selectedUser, setSelectedUser] = useState(users[0].name);

  const handleLogin = () => {
    if (selectedUser) setUser(selectedUser);
  };

  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h1>HACCP App Login</h1>
      <p>Select your user:</p>
      <select
        value={selectedUser}
        onChange={(e) => setSelectedUser(e.target.value)}
        style={{ padding: "10px", fontSize: "16px" }}
      >
        {users.map((user) => (
          <option key={user.name} value={user.name}>
            {user.name} ({user.role})
          </option>
        ))}
      </select>
      <br />
      <button
        onClick={handleLogin}
        style={{ marginTop: "20px", padding: "10px 20px", fontSize: "16px" }}
      >
        Login
      </button>
    </div>
  );
};

export default LoginPage;