// src/components/StaffManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query, orderBy, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { FaChevronLeft, FaUserPlus, FaUserSlash, FaUserCheck } from "react-icons/fa";

const STAFF_COLLECTION = "stafflogin";

const chip = (bg, fg) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: bg,
  color: fg,
});

const roleChip = (role) => {
  const r = (role || "Staff").toLowerCase();
  if (r === "manager") return chip("#eef2ff", "#3730a3");
  return chip("#f3f4f6", "#374151");
};

const statusChip = (active) => (active ? chip("#dcfce7", "#166534") : chip("#fee2e2", "#991b1b"));

const StaffManager = ({ goBack }) => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Staff");
  const [staff, setStaff] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, STAFF_COLLECTION), orderBy("name")),
      (snap) => setStaff(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Staff subscribe error:", err);
        setStaff([]);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (showInactive) return staff;
    return staff.filter((s) => s.active !== false);
  }, [staff, showInactive]);

  const canAdd = useMemo(() => name.trim().length > 0 && !busy, [name, busy]);

  const addStaff = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, STAFF_COLLECTION), {
        name: name.trim(),
        role,
        active: true,
        createdAt: new Date(),
      });
      setName("");
      setRole("Staff");
    } catch (e) {
      console.error("Add staff failed:", e);
      alert("Couldn’t add staff. Check Firestore permissions / connection.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (s) => {
    if (!s?.id) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, STAFF_COLLECTION, s.id), { active: !(s.active !== false) });
    } catch (e) {
      console.error("Toggle active failed:", e);
      alert("Couldn’t update staff. Check Firestore permissions / connection.");
    } finally {
      setBusy(false);
    }
  };

  const toggleBtn = (active) => ({
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: active ? "#2563eb" : "#fff",
    color: active ? "#fff" : "#111",
    fontWeight: 800,
    cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={goBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
        >
          <FaChevronLeft /> Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "#f3f4f6",
              display: "grid",
              placeItems: "center",
            }}
          >
            <FaUserCheck color="#374151" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#111" }}>Staff</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Manage who can log entries</div>
          </div>
        </div>
      </div>

      {/* Add staff card */}
      <div
        style={{
          marginTop: 18,
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, color: "#111" }}>Add staff member</div>
          <span style={chip("#eef2ff", "#3730a3")}>Shows on login</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 12, marginTop: 14 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name e.g. Sam"
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              outline: "none",
            }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <option value="Manager">Manager</option>
            <option value="Staff">Staff</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={addStaff}
            disabled={!canAdd}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              background: canAdd ? "#2563eb" : "#93c5fd",
              color: "#fff",
              fontWeight: 900,
              cursor: canAdd ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => {
              if (canAdd) e.currentTarget.style.backgroundColor = "#1d4ed8";
            }}
            onMouseLeave={(e) => {
              if (canAdd) e.currentTarget.style.backgroundColor = "#2563eb";
            }}
          >
            <FaUserPlus /> {busy ? "Saving..." : "Add staff"}
          </button>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setShowInactive(false)} style={toggleBtn(!showInactive)}>
              Active
            </button>
            <button onClick={() => setShowInactive(true)} style={toggleBtn(showInactive)}>
              All
            </button>
          </div>
        </div>
      </div>

      {/* List card */}
      <div
        style={{
          marginTop: 18,
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, color: "#111" }}>Existing staff</div>
          <span style={chip("#f3f4f6", "#111827")}>{filtered.length} shown</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ marginTop: 14, color: "#6b7280", fontSize: 13 }}>
            No staff to show.
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {filtered.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 14,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.backgroundColor = "#fff";
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, color: "#111", fontSize: 15 }}>
                    {s.name}{" "}
                    <span style={{ ...roleChip(s.role), marginLeft: 8 }}>{s.role || "Staff"}</span>{" "}
                    <span style={{ ...statusChip(s.active !== false), marginLeft: 8 }}>
                      {s.active !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    {s.active !== false ? "Can be selected at login" : "Hidden from login"}
                  </div>
                </div>

                <button
                  onClick={() => toggleActive(s)}
                  disabled={busy}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    cursor: busy ? "not-allowed" : "pointer",
                    fontWeight: 900,
                    color: s.active !== false ? "#b91c1c" : "#16a34a",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!busy) e.currentTarget.style.backgroundColor = "#f9fafb";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#fff";
                  }}
                >
                  <FaUserSlash /> {s.active !== false ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffManager;