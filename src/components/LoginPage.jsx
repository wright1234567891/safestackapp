// src/components/LoginPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";

const STAFF_COLLECTION = "StaffLogin";

const LoginPage = ({ setUser }) => {
  const [staff, setStaff] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, STAFF_COLLECTION), where("active", "==", true), orderBy("name")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setStaff(rows);
        // pick first active staff by default
        setSelectedId((prev) => prev || rows[0]?.id || "");
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
    if (!selectedUser) return;
    setUser({
      id: selectedUser.id,
      name: selectedUser.name,
      role: selectedUser.role || "Staff",
    });
  };

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 10, color: "#fff", textAlign: "center" }}>
        SafeStack Login
      </h1>
      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.75)", marginBottom: 18 }}>
        Choose your name to start logging
      </p>

      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 6px rgba(0,0,0,0.20)" }}>
        <div style={{ fontWeight: 900, color: "#111", marginBottom: 10 }}>Select user</div>

        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
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

        <button
          onClick={handleLogin}
          disabled={!selectedUser}
          style={{
            marginTop: 14,
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "none",
            background: selectedUser ? "#2563eb" : "#93c5fd",
            color: "#fff",
            fontWeight: 900,
            cursor: selectedUser ? "pointer" : "not-allowed",
          }}
        >
          Login
        </button>

        {!staff.length && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            No active users found. Add at least one in Staff Manager (or Firestore) and try again.
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;