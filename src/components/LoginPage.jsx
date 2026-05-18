// src/components/LoginPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

const STAFF_COLLECTION = "stafflogin";

const LoginPage = ({ setUser }) => {
  const [staff, setStaff] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, STAFF_COLLECTION), orderBy("name")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Treat missing active as active, same as StaffManager
        const activeRows = rows.filter((s) => s.active !== false);

        setStaff(activeRows);
        setSelectedId((prev) => prev || activeRows[0]?.id || "");
      },
      (err) => {
        console.error("Login staff subscribe error:", err);
        setStaff([]);
      }
    );

    return () => unsub();
  }, []);

  const selectedUser = useMemo(
    () => staff.find((s) => s.id === selectedId) || null,
    [staff, selectedId]
  );

  const handleLogin = () => {
    setError("");

    if (!selectedUser) return;

    if (!selectedUser.pin) {
      setError("No PIN set for this user. Ask a manager to add one.");
      return;
    }

    if (pin.trim() !== String(selectedUser.pin).trim()) {
      setError("Incorrect PIN.");
      return;
    }

    setUser({
      id: selectedUser.id,
      name: selectedUser.name,
      email: selectedUser.email || "",
      role: selectedUser.role || "Staff",
    });
  };

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 10, color: "#fff", textAlign: "center" }}>
        SafeStack Login
      </h1>
      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.75)", marginBottom: 18 }}>
        Choose your name and enter your PIN
      </p>

      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 6px rgba(0,0,0,0.20)" }}>
        <div style={{ fontWeight: 900, color: "#111", marginBottom: 10 }}>Select user</div>

        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setPin("");
            setError("");
          }}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fff",
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.role || "Staff"})
            </option>
          ))}
        </select>

        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
          placeholder="Enter PIN"
          style={{
            marginTop: 12,
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fff",
            fontSize: 15,
            outline: "none",
          }}
        />

        {error && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#b91c1c", fontWeight: 800 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={!selectedUser || !pin.trim()}
          style={{
            marginTop: 14,
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "none",
            background: selectedUser && pin.trim() ? "#2563eb" : "#93c5fd",
            color: "#fff",
            fontWeight: 900,
            cursor: selectedUser && pin.trim() ? "pointer" : "not-allowed",
          }}
        >
          Login
        </button>

        {!staff.length && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            No active users found. Add at least one in Staff Manager and try again.
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;