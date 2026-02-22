// src/components/HowToSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  FaChevronLeft,
  FaPlus,
  FaTrash,
  FaEdit,
  FaSave,
  FaTimes,
  FaSearch,
} from "react-icons/fa";

// Small chip helper (same style family as SitePage/EquipmentManager)
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

const fmtDate = (ts) => {
  const d = ts?.toDate?.();
  if (!d) return "";
  return d.toLocaleString();
};

// Safe sort helper (serverTimestamp can be null until resolved)
const toMillisSafe = (ts) => (ts?.toMillis?.() ? ts.toMillis() : 0);

export default function HowToSection({ site, user, goBack }) {
  const [guides, setGuides] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // create form
  const [title, setTitle] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  // edit state
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStepsText, setEditStepsText] = useState("");

  useEffect(() => {
    if (!site) return;

    // ✅ No orderBy -> avoids composite index requirement.
    const q = query(collection(db, "howtos"), where("site", "==", site));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // ✅ Sort newest first client-side
        rows.sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));

        setGuides(rows);
      },
      (err) => {
        console.error("HowTo subscribe error:", err);
        // ✅ DON'T wipe the list; keep last good state so it doesn't "disappear"
        // setGuides([]);
      }
    );

    return () => unsub();
  }, [site]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return guides;
    return guides.filter((g) => (g.title || "").toLowerCase().includes(s));
  }, [guides, search]);

  const stepsFromText = (text) =>
    text
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

  const canSaveNew =
    title.trim().length > 0 &&
    stepsFromText(stepsText).length > 0 &&
    !busy;

  const addGuide = async () => {
    if (!canSaveNew) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "howtos"), {
        site,
        title: title.trim(),
        steps: stepsFromText(stepsText),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid || null,
        createdByName: user?.name || user?.displayName || null,
      });

      setTitle("");
      setStepsText("");
    } catch (e) {
      console.error("Add guide failed:", e);
      alert("Couldn’t save the guide. Check connection/permissions.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (g) => {
    setEditingId(g.id);
    setEditTitle(g.title || "");
    setEditStepsText((g.steps || []).join("\n"));
    setExpandedId(g.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditStepsText("");
  };

  const saveEdit = async (id) => {
    const newTitle = editTitle.trim();
    const newSteps = stepsFromText(editStepsText);

    if (!newTitle || newSteps.length === 0) {
      alert("Title and at least 1 step are required.");
      return;
    }

    setBusy(true);
    try {
      await updateDoc(doc(db, "howtos", id), {
        title: newTitle,
        steps: newSteps,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null,
        updatedByName: user?.name || user?.displayName || null,
      });
      cancelEdit();
    } catch (e) {
      console.error("Edit guide failed:", e);
      alert("Couldn’t update the guide.");
    } finally {
      setBusy(false);
    }
  };

  const removeGuide = async (id, title) => {
    const ok = window.confirm(`Delete "${title || "this guide"}"?`);
    if (!ok) return;

    setBusy(true);
    try {
      await deleteDoc(doc(db, "howtos", id));
      if (expandedId === id) setExpandedId(null);
      if (editingId === id) cancelEdit();
    } catch (e) {
      console.error("Delete guide failed:", e);
      alert("Couldn’t delete the guide.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
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
            fontWeight: 700,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
        >
          <FaChevronLeft /> Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={chip("#ecfeff", "#075985")}>How-To Guides</div>
          <div style={chip("#f3f4f6", "#111827")}>{site}</div>
        </div>
      </div>

      {/* Create card */}
      <div
        style={{
          marginTop: 18,
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 900, color: "#111" }}>Create a guide</div>
          <span style={chip("#eef2ff", "#3730a3")}>One step per line</span>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Guide title (e.g. Flat White, Brisket on Rye)"
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              outline: "none",
            }}
          />

          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            placeholder={"Steps (one per line)\n1) ...\n2) ...\n3) ..."}
            rows={6}
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              fontSize: 14,
              outline: "none",
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={addGuide}
              disabled={!canSaveNew}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                background: canSaveNew ? "#2563eb" : "#93c5fd",
                color: "#fff",
                cursor: canSaveNew ? "pointer" : "not-allowed",
                fontWeight: 900,
              }}
              onMouseEnter={(e) => {
                if (canSaveNew) e.currentTarget.style.backgroundColor = "#1d4ed8";
              }}
              onMouseLeave={(e) => {
                if (canSaveNew) e.currentTarget.style.backgroundColor = "#2563eb";
              }}
            >
              <FaPlus /> {busy ? "Saving..." : "Save guide"}
            </button>

            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Tip: keep it short + consistent so staff can follow it under pressure.
            </div>
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 900, color: "#111" }}>Guides</div>
          <span style={chip("#f3f4f6", "#111827")}>{filtered.length} item(s)</span>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: "#f3f4f6", display: "grid", placeItems: "center" }}>
              <FaSearch color="#374151" />
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guides…"
              style={{
                width: "100%",
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {filtered.length === 0 ? (
            <div style={{ marginTop: 10, color: "#6b7280", fontSize: 13 }}>
              No guides yet for this venue. Create one above.
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {filtered.map((g) => {
                const expanded = expandedId === g.id;
                const isEditing = editingId === g.id;

                return (
                  <div
                    key={g.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 14,
                      transition: "all 0.2s ease",
                      background: expanded ? "#f9fafb" : "#fff",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.08)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {/* top row */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <button
                        onClick={() => setExpandedId(expanded ? null : g.id)}
                        style={{
                          textAlign: "left",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: 0,
                          fontWeight: 900,
                          fontSize: 16,
                          color: "#111",
                          flex: 1,
                        }}
                        title="Click to expand"
                      >
                        {g.title || "Untitled guide"}
                      </button>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={chip("#eef2ff", "#3730a3")}>{(g.steps || []).length} steps</span>

                        {!isEditing && (
                          <button
                            onClick={() => startEdit(g)}
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
                            }}
                          >
                            <FaEdit /> Edit
                          </button>
                        )}

                        <button
                          onClick={() => removeGuide(g.id, g.title)}
                          disabled={busy}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #fee2e2",
                            background: "#fff",
                            color: "#b91c1c",
                            cursor: busy ? "not-allowed" : "pointer",
                            fontWeight: 900,
                          }}
                        >
                          <FaTrash /> Delete
                        </button>
                      </div>
                    </div>

                    {/* metadata */}
                    <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      {g.createdAt && <span style={chip("#f3f4f6", "#374151")}>Created: {fmtDate(g.createdAt)}</span>}
                      {(g.createdByName || g.createdBy) && (
                        <span style={chip("#f3f4f6", "#374151")}>By: {g.createdByName || g.createdBy}</span>
                      )}
                      {g.updatedAt && <span style={chip("#f3f4f6", "#374151")}>Updated: {fmtDate(g.updatedAt)}</span>}
                    </div>

                    {/* body */}
                    {expanded && (
                      <div style={{ marginTop: 12 }}>
                        {isEditing ? (
                          <div style={{ display: "grid", gap: 10 }}>
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              style={{
                                padding: "12px 12px",
                                borderRadius: 12,
                                border: "1px solid #e5e7eb",
                                fontSize: 14,
                                outline: "none",
                              }}
                            />
                            <textarea
                              value={editStepsText}
                              onChange={(e) => setEditStepsText(e.target.value)}
                              rows={6}
                              style={{
                                padding: "12px 12px",
                                borderRadius: 12,
                                border: "1px solid #e5e7eb",
                                fontSize: 14,
                                outline: "none",
                                resize: "vertical",
                              }}
                            />

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <button
                                onClick={() => saveEdit(g.id)}
                                disabled={busy}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "12px 14px",
                                  borderRadius: 12,
                                  border: "none",
                                  background: "#16a34a",
                                  color: "#fff",
                                  cursor: busy ? "not-allowed" : "pointer",
                                  fontWeight: 900,
                                }}
                              >
                                <FaSave /> Save changes
                              </button>

                              <button
                                onClick={cancelEdit}
                                disabled={busy}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "12px 14px",
                                  borderRadius: 12,
                                  border: "1px solid #e5e7eb",
                                  background: "#fff",
                                  cursor: busy ? "not-allowed" : "pointer",
                                  fontWeight: 900,
                                }}
                              >
                                <FaTimes /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <ol style={{ margin: "8px 0 0 18px", color: "#111", display: "grid", gap: 6 }}>
                            {(g.steps || []).map((s, idx) => (
                              <li key={idx} style={{ lineHeight: 1.35 }}>
                                {s}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}