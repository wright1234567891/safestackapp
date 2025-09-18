// src/components/ChecklistSection.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ---------- Helpers ----------
const formatTimestamp = (ts) => {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleString();
};

// Subtle shadow + elevation helpers
const elevate = (el) => {
  el.style.transform = "translateY(-2px)";
  el.style.boxShadow = "0 6px 12px rgba(0,0,0,0.12)";
  el.style.backgroundColor = "#f9fafb";
};
const normalize = (el) => {
  el.style.transform = "translateY(0)";
  el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
  el.style.backgroundColor = "#fff";
};

const freqChip = (f) => {
  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: 12,
    fontWeight: 700,
    marginLeft: 8,
  };
  switch ((f || "Ad hoc").toLowerCase()) {
    case "daily":
      return { ...base, background: "#ecfeff", color: "#075985" };
    case "weekly":
      return { ...base, background: "#f5f3ff", color: "#5b21b6" };
    case "monthly":
      return { ...base, background: "#fef3c7", color: "#92400e" };
    default:
      return { ...base, background: "#e5e7eb", color: "#111827" }; // Ad hoc / missing
  }
};

const ChecklistSection = ({ goBack, site, user }) => {
  const [checklists, setChecklists] = useState([]);
  const [completed, setCompleted] = useState([]);

  // Authoring state (Create)
  const [adding, setAdding] = useState(false);
  const [titleSet, setTitleSet] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState("");
  const [newFrequency, setNewFrequency] = useState("Daily");
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");

  // Editing state (Edit existing)
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFrequency, setEditFrequency] = useState("Ad hoc");
  const [editItems, setEditItems] = useState([]);
  const [editNewItem, setEditNewItem] = useState("");

  // keep focus steady on the “new question” field
  const newItemRef = useRef(null);
  const editNewItemRef = useRef(null);

  // Working state (Run / View)
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [viewingCompleted, setViewingCompleted] = useState(null);

  // Adjust if user is an object in your app; this mirrors your current approach.
  const isManager = ["Chris", "Chloe"].includes(user);

  // Firestore refs
  const checklistCollectionRef = collection(db, "checklists");
  const completedCollectionRef = collection(db, "completed");

  // ---------- Fetch (site-scoped + reacts to site change) ----------
  useEffect(() => {
    if (!site) return;

    const fetchData = async () => {
      try {
        // Try the preferred query (requires composite index: site + createdAt desc)
        const qChecklist = query(
          checklistCollectionRef,
          where("site", "==", site),
          orderBy("createdAt", "desc")
        );
        const checklistSnapshot = await getDocs(qChecklist);
        setChecklists(checklistSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        // Fallback without orderBy and client-side sort
        try {
          const qChecklistFallback = query(
            checklistCollectionRef,
            where("site", "==", site)
          );
          const snap = await getDocs(qChecklistFallback);
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          rows.sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? 0;
            const tb = b.createdAt?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setChecklists(rows);
        } catch (err2) {
          console.error("Error fetching checklists:", err2);
          setChecklists([]);
        }
      }

      try {
        const qCompleted = query(
          completedCollectionRef,
          where("site", "==", site),
          orderBy("createdAt", "desc")
        );
        const completedSnapshot = await getDocs(qCompleted);
        setCompleted(completedSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        try {
          const qCompletedFallback = query(
            completedCollectionRef,
            where("site", "==", site)
          );
          const snap = await getDocs(qCompletedFallback);
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          rows.sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? 0;
            const tb = b.createdAt?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setCompleted(rows);
        } catch (err2) {
          console.error("Error fetching completed:", err2);
          setCompleted([]);
        }
      }
    };

    fetchData();
    // reset transient states when switching sites
    resetView();
  }, [site]); // 👈 re-run when site changes

  const siteChecklists = checklists; // already filtered by query
  const siteCompleted = completed;   // already filtered by query

  // ---------- Focus helpers ----------
  useEffect(() => {
    if (adding && titleSet) {
      requestAnimationFrame(() => newItemRef.current?.focus());
    }
  }, [adding, titleSet]);
  useEffect(() => {
    if (editingId) {
      requestAnimationFrame(() => editNewItemRef.current?.focus());
    }
  }, [editingId]);

  // ---------- Authoring (Create) ----------
  const addItemAuthor = () => {
    if (!newItem.trim()) return;
    setItems((prev) => [
      ...prev,
      { text: newItem.trim(), answer: null, corrective: "" },
    ]);
    setNewItem("");
    requestAnimationFrame(() => newItemRef.current?.focus());
  };
  const updateItemAuthor = (index, text) => {
    const updated = [...items];
    updated[index] = { ...updated[index], text };
    setItems(updated);
  };
  const removeItemAuthor = (index) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const saveChecklist = async () => {
    if (!checklistTitle.trim() || items.length === 0) {
      alert("Checklist must have a title and at least one question");
      return;
    }

    const record = {
      site,
      title: checklistTitle.trim(),
      frequency: newFrequency || "Ad hoc",
      questions: items,
      createdAt: Timestamp.now(),
      person: user || "Unknown",
    };

    try {
      const docRef = await addDoc(checklistCollectionRef, record);
      setChecklists((prev) => [{ id: docRef.id, ...record }, ...prev]);
      // Reset create state
      setChecklistTitle("");
      setNewFrequency("Daily");
      setItems([]);
      setTitleSet(false);
      setAdding(false);
    } catch (error) {
      console.error("Error adding checklist:", error);
    }
  };

  // ---------- Editing (Edit existing) ----------
  const startEditChecklist = (cl) => {
    setEditingId(cl.id);
    setEditTitle(cl.title || "");
    setEditFrequency(cl.frequency || "Ad hoc");
    // Clone to avoid mutating original
    setEditItems((Array.isArray(cl.questions) ? cl.questions : []).map((q) => ({ ...q })));
    // Leave other modes
    setAdding(false);
    setTitleSet(false);
    setSelectedChecklist(null);
    setViewingCompleted(null);
  };

  const addEditItem = () => {
    if (!editNewItem.trim()) return;
    setEditItems((prev) => [
      ...prev,
      { text: editNewItem.trim(), answer: null, corrective: "" },
    ]);
    setEditNewItem("");
    requestAnimationFrame(() => editNewItemRef.current?.focus());
  };
  const updateEditItem = (index, text) => {
    const updated = [...editItems];
    updated[index] = { ...updated[index], text };
    setEditItems(updated);
  };
  const removeEditItem = (index) => {
    const updated = [...editItems];
    updated.splice(index, 1);
    setEditItems(updated);
  };

  const saveEditChecklist = async () => {
    if (!editingId) return;
    if (!editTitle.trim() || editItems.length === 0) {
      alert("Checklist must have a title and at least one question");
      return;
    }
    try {
      await updateDoc(doc(db, "checklists", editingId), {
        title: editTitle.trim(),
        frequency: editFrequency || "Ad hoc",
        questions: editItems,
        updatedAt: Timestamp.now(),
        updatedBy: user || "Unknown",
      });
      // Reflect in local state
      setChecklists((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? {
                ...c,
                title: editTitle.trim(),
                frequency: editFrequency || "Ad hoc",
                questions: editItems,
              }
            : c
        )
      );
      // Exit edit mode
      setEditingId(null);
      setEditTitle("");
      setEditFrequency("Ad hoc");
      setEditItems([]);
      setEditNewItem("");
    } catch (err) {
      console.error("Error saving checklist edits:", err);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditFrequency("Ad hoc");
    setEditItems([]);
    setEditNewItem("");
  };

  // ---------- Running (complete answers) ----------
  const openChecklist = (cl) => {
    const freshQuestions = (cl.questions || []).map((q) => ({
      ...q,
      answer: null,
      corrective: "",
    }));
    setSelectedChecklist(cl);
    setItems(freshQuestions);
    // leave other modes
    setAdding(false);
    setTitleSet(false);
    setEditingId(null);
  };

  const handleAnswerChange = (index, value) => {
    const updated = [...items];
    updated[index].answer = value;
    if (value === "Yes") updated[index].corrective = "";
    setItems(updated);
  };
  const handleCorrectiveChange = (index, value) => {
    const updated = [...items];
    updated[index].corrective = value;
    setItems(updated);
  };

  const saveAnswers = async () => {
    if (!selectedChecklist) return;

    try {
      await updateDoc(doc(db, "checklists", selectedChecklist.id), {
        questions: items,
      });

      const now = Timestamp.now();
      const completedEntry = {
        // 👇 ADDED: this links completions to a source checklist for SitePage overview
        checklistId: selectedChecklist.id,
        title: selectedChecklist.title,
        person: user || "Unknown",
        questions: items,
        site,
        createdAt: now,
        frequency: selectedChecklist.frequency || "Ad hoc",
      };

      const docRef = await addDoc(completedCollectionRef, completedEntry);
      setCompleted((prev) => [{ id: docRef.id, ...completedEntry }, ...prev]);

      setSelectedChecklist(null);
      setItems([]);
    } catch (error) {
      console.error("Error saving answers:", error);
    }
  };

  const deleteChecklist = async (cl) => {
    if (!window.confirm(`Delete checklist "${cl.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "checklists", cl.id));
      setChecklists((prev) => prev.filter((c) => c.id !== cl.id));
    } catch (error) {
      console.error("Error deleting checklist:", error);
    }
  };

  const deleteCompleted = async (entry) => {
    if (!window.confirm(`Delete completed checklist "${entry.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "completed", entry.id));
      setCompleted((prev) => prev.filter((c) => c.id !== entry.id));
    } catch (error) {
      console.error("Error deleting completed:", error);
    }
  };

  const viewCompleted = (c) => {
    setViewingCompleted(c);
    setItems(c.questions.map((q) => ({ ...q })));
  };

  const resetView = () => {
    // Create
    setAdding(false);
    setTitleSet(false);
    setChecklistTitle("");
    setNewFrequency("Daily");
    setItems([]);
    setNewItem("");
    // Run/View
    setSelectedChecklist(null);
    setViewingCompleted(null);
    // Edit
    setEditingId(null);
    setEditTitle("");
    setEditFrequency("Ad hoc");
    setEditItems([]);
    setEditNewItem("");
  };

  // ---------- Export ----------
  const exportChecklistToPDF = async (
    title,
    questions,
    completedBy = user,
    ts = Timestamp.now()
  ) => {
    const element = document.createElement("div");
    element.style.padding = "24px";
    element.style.backgroundColor = "#fff";
    element.style.color = "#111827";
    element.style.width = "600px";
    element.style.fontFamily = "Inter, system-ui, -apple-system, Arial";

    const titleEl = document.createElement("h2");
    titleEl.innerText = title;
    titleEl.style.margin = "0 0 8px 0";
    element.appendChild(titleEl);

    const subTitleEl = document.createElement("p");
    subTitleEl.innerText = `Completed by: ${completedBy} — ${formatTimestamp(ts)}`;
    subTitleEl.style.margin = "0 0 16px 0";
    element.appendChild(subTitleEl);

    questions.forEach((q, idx) => {
      const qEl = document.createElement("p");
      qEl.style.margin = "0 0 8px 0";
      qEl.innerText = `${idx + 1}. ${q.text} — Answer: ${q.answer || "N/A"}${
        q.answer === "No" && q.corrective ? ` — Corrective: ${q.corrective}` : ""
      }`;
      element.appendChild(qEl);
    });

    document.body.appendChild(element);

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${title}.pdf`);

    document.body.removeChild(element);
  };

  const exportAllCompletedToPDF = async () => {
    if (siteCompleted.length === 0) {
      alert("No completed checklists to export");
      return;
    }

    const element = document.createElement("div");
    element.style.padding = "24px";
    element.style.backgroundColor = "#fff";
    element.style.color = "#111827";
    element.style.width = "600px";
    element.style.fontFamily = "Inter, system-ui, -apple-system, Arial";

    const titleEl = document.createElement("h2");
    titleEl.innerText = `${site} — All Completed Checklists`;
    titleEl.style.margin = "0 0 16px 0";
    element.appendChild(titleEl);

    siteCompleted.forEach((c, cIdx) => {
      const subTitle = document.createElement("h3");
      subTitle.innerText = `${cIdx + 1}. ${c.title} (Completed by ${c.person} at ${formatTimestamp(
        c.createdAt
      )})`;
      subTitle.style.margin = "16px 0 8px 0";
      element.appendChild(subTitle);

      c.questions.forEach((q, idx) => {
        const qEl = document.createElement("p");
        qEl.style.margin = "0 0 6px 0";
        qEl.innerText = `${idx + 1}. ${q.text} — Answer: ${q.answer || "N/A"}${
          q.answer === "No" && q.corrective ? ` — Corrective: ${q.corrective}` : ""
        }`;
        element.appendChild(qEl);
      });

      element.appendChild(document.createElement("hr"));
    });

    document.body.appendChild(element);

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${site}-all-completed-checklists.pdf`);

    document.body.removeChild(element);
  };

  // ---------- UI primitives ----------
  const Button = ({
    children,
    onClick,
    kind = "neutral",
    style = {},
    tabIndex = 0,
    type = "button",
  }) => {
    const palette = {
      neutral: { bg: "#f3f4f6", hover: "#e5e7eb", color: "#111" },
      primary: { bg: "#2563eb", hover: "#1d4ed8", color: "#fff" },
      success: { bg: "#059669", hover: "#047857", color: "#fff" },
      warn: { bg: "#f59e0b", hover: "#d97706", color: "#111" },
      danger: { bg: "#ef4444", hover: "#dc2626", color: "#fff" },
      subtle: { bg: "#fff", hover: "#f9fafb", color: "#111" },
    };

    const p = palette[kind] || palette.neutral;
    const base = {
      padding: "10px 16px",
      borderRadius: "10px",
      cursor: "pointer",
      backgroundColor: p.bg,
      color: p.color,
      fontSize: "14px",
      fontWeight: 600,
      border: "none",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      transition: "all 0.2s ease",
      ...style,
    };

    return (
      <button
        type={type}
        onClick={onClick}
        style={base}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = p.hover)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = p.bg)}
        tabIndex={tabIndex}
      >
        {children}
      </button>
    );
  };

  const Card = ({ children, onClick, hoverable = true, style = {} }) => (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        borderRadius: "14px",
        padding: "16px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        transition: "all 0.2s ease",
        textAlign: "left",
        position: "relative",
        ...style,
      }}
      onMouseEnter={(e) => hoverable && elevate(e.currentTarget)}
      onMouseLeave={(e) => hoverable && normalize(e.currentTarget)}
    >
      {children}
    </div>
  );

  const SectionTitle = ({ children, style = {} }) => (
    <h2
      style={{
        fontSize: "18px",
        color: "#111",
        fontWeight: 700,
        margin: "16px 0 10px",
        textAlign: "left",
        ...style,
      }}
    >
      {children}
    </h2>
  );

  // ---------- Render helpers ----------
  // For RUN/VIEW — shows Yes/No + corrective
  const renderChecklistItemsRun = (editable = true) =>
    items.map((item, index) => {
      const yesActive = item.answer === "Yes";
      const noActive = item.answer === "No";

      return (
        <Card key={index} hoverable={false} style={{ margin: "10px 0" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1, color: "#111" }}>{item.text}</div>

            {/* Toggle buttons for Yes/No */}
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                kind={yesActive ? "success" : "subtle"}
                onClick={editable ? () => handleAnswerChange(index, "Yes") : undefined}
                style={{
                  border: yesActive ? "1px solid #059669" : "1px solid #e5e7eb",
                }}
              >
                Yes
              </Button>
              <Button
                kind={noActive ? "danger" : "subtle"}
                onClick={editable ? () => handleAnswerChange(index, "No") : undefined}
                style={{
                  border: noActive ? "1px solid #ef4444" : "1px solid #e5e7eb",
                }}
              >
                No
              </Button>
            </div>
          </div>

          {/* Corrective input when "No" */}
          {item.answer === "No" && (
            <input
              type="text"
              placeholder="Corrective action"
              value={item.corrective}
              onChange={editable ? (e) => handleCorrectiveChange(index, e.target.value) : undefined}
              readOnly={!editable}
              style={{
                marginTop: "12px",
                padding: "10px 12px",
                borderRadius: "10px",
                width: "100%",
                border: "1px solid #e5e7eb",
                outline: "none",
                fontSize: "14px",
              }}
            />
          )}
        </Card>
      );
    });

  // For CREATE/EDIT — text inputs for questions
  const renderAuthoringItems = (list, onUpdate, onRemove) =>
    list.map((item, index) => {
      return (
        <Card key={index} hoverable={false} style={{ margin: "10px 0" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              value={item.text}
              onChange={(e) => onUpdate(index, e.target.value)}
              placeholder={`Question ${index + 1}`}
              style={{
                padding: "12px 14px",
                fontSize: "15px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                outline: "none",
                flex: 1,
              }}
            />
            <Button
              kind="danger"
              onClick={() => onRemove(index)}
              style={{ padding: "10px 12px" }}
            >
              Remove
            </Button>
          </div>
        </Card>
      );
    });

  // ---------- Main Render ----------
  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "32px 20px 44px",
        fontFamily: "'Inter', system-ui, -apple-system, Arial",
      }}
    >
      {/* Header / Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <h1
            style={{
              fontSize: "28px",
              color: "#111",
              fontWeight: 700,
              margin: 0,
            }}
          >
            {site} — Checklists
          </h1>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Create, edit, complete, and export your venue checklists
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={goBack}>Back</Button>
          {isManager && !editingId && (
            <Button
              kind="primary"
              onClick={() => {
                setAdding(true);
                setSelectedChecklist(null);
                setViewingCompleted(null);
                setEditingId(null);
              }}
            >
              + Add Checklist
            </Button>
          )}
          {siteCompleted.length > 0 && (
            <Button kind="warn" onClick={exportAllCompletedToPDF}>
              Export All Completed
            </Button>
          )}
        </div>
      </div>

      {/* MAIN VIEW */}
      {!adding && !selectedChecklist && !viewingCompleted && !editingId && (
        <>
          <SectionTitle>Your Checklists</SectionTitle>

          {siteChecklists.length === 0 && (
            <Card hoverable={false} style={{ textAlign: "center" }}>
              <div style={{ color: "#6b7280" }}>
                No checklists yet for this site.
              </div>
              {isManager && (
                <Button
                  kind="primary"
                  onClick={() => setAdding(true)}
                  style={{ marginTop: 12 }}
                >
                  Create your first checklist
                </Button>
              )}
            </Card>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {siteChecklists.map((cl) => (
              <Card key={cl.id} onClick={() => openChecklist(cl)}>
                <div style={{ paddingRight: 104 }}>
                  <div
                    style={{ fontWeight: 700, color: "#111", marginBottom: 6, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}
                  >
                    {cl.title}
                    <span style={freqChip(cl.frequency)}>{cl.frequency || "Ad hoc"}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {Array.isArray(cl.questions) ? cl.questions.length : 0} question
                    {Array.isArray(cl.questions) && cl.questions.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {isManager && (
                  <>
                    <Button
                      kind="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditChecklist(cl);
                      }}
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 74,
                        padding: "6px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      kind="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChecklist(cl);
                      }}
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        padding: "6px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </Card>
            ))}
          </div>

          {siteCompleted.length > 0 && (
            <>
              <SectionTitle style={{ marginTop: 24 }}>
                Completed Checklists
              </SectionTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 14,
                }}
              >
                {siteCompleted.map((c) => (
                  <Card key={c.id} onClick={() => viewCompleted(c)}>
                    <div style={{ paddingRight: 64 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#111",
                          marginBottom: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {c.title}
                        {c.frequency && (
                          <span style={freqChip(c.frequency)}>{c.frequency}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>
                        By {c.person} • {formatTimestamp(c.createdAt)}
                      </div>
                    </div>
                    {isManager && (
                      <Button
                        kind="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCompleted(c);
                        }}
                        style={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          padding: "6px 10px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ADD CHECKLIST — TITLE STEP */}
      {adding && !titleSet && !editingId && (
        <Card hoverable={false}>
          <SectionTitle>New Checklist</SectionTitle>
          <div style={{ color: "#6b7280", marginBottom: 10 }}>
            Give your checklist a clear, descriptive title and frequency.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              value={checklistTitle}
              onChange={(e) => setChecklistTitle(e.target.value)}
              placeholder="e.g. Opening Checks"
              style={{
                padding: "12px 14px",
                fontSize: "15px",
                flex: 2,
                minWidth: 260,
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                outline: "none",
              }}
            />
            <select
              value={newFrequency}
              onChange={(e) => setNewFrequency(e.target.value)}
              style={{
                padding: "12px 14px",
                fontSize: "15px",
                flex: 1,
                minWidth: 180,
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                outline: "none",
                background: "#fff",
              }}
            >
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
              <option>Ad hoc</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Button
              kind="primary"
              onClick={() => checklistTitle.trim() !== "" && setTitleSet(true)}
            >
              Start Adding Questions
            </Button>
            <Button onClick={resetView}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* ADD CHECKLIST — QUESTIONS STEP (Authoring items) */}
      {adding && titleSet && !editingId && (
        <Card hoverable={false}>
          <SectionTitle>
            {checklistTitle}
            <span style={freqChip(newFrequency)}>{newFrequency}</span>
          </SectionTitle>
          <div style={{ color: "#6b7280", marginBottom: 10 }}>
            Add your questions. You can remove or edit them before saving.
          </div>

          {renderAuthoringItems(items, updateItemAuthor, removeItemAuthor)}

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 10,
              alignItems: "center",
            }}
          >
            <input
              ref={newItemRef}
              type="text"
              autoFocus={adding && titleSet}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItemAuthor();
                }
              }}
              placeholder="New question"
              style={{
                padding: "12px 14px",
                fontSize: "15px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                outline: "none",
                flex: 1,
              }}
            />
            <Button kind="subtle" onClick={addItemAuthor}>
              + Add Question
            </Button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Button kind="success" onClick={saveChecklist}>
              Save Checklist
            </Button>
            <Button onClick={resetView}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* EDIT CHECKLIST — full edit (title, frequency, questions) */}
      {editingId && !adding && !selectedChecklist && !viewingCompleted && (
        <Card hoverable={false}>
          <SectionTitle>Edit Checklist</SectionTitle>
          <div style={{ color: "#6b7280", marginBottom: 10 }}>
            Update the title, frequency, and questions below.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Checklist title"
              style={{
                padding: "12px 14px",
                fontSize: "15px",
                flex: 2,
                minWidth: 260,
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                outline: "none",
              }}
            />
            <select
              value={editFrequency}
              onChange={(e) => setEditFrequency(e.target.value)}
              style={{
                padding: "12px 14px",
                fontSize: "15px",
                flex: 1,
                minWidth: 180,
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                outline: "none",
                background: "#fff",
              }}
            >
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
              <option>Ad hoc</option>
            </select>
          </div>

          {renderAuthoringItems(editItems, updateEditItem, removeEditItem)}

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 10,
              alignItems: "center",
            }}
          >
            <input
              ref={editNewItemRef}
              type="text"
              value={editNewItem}
              onChange={(e) => setEditNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addEditItem();
                }
              }}
              placeholder="New question"
              style={{
                padding: "12px 14px",
                fontSize: "15px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                outline: "none",
                flex: 1,
              }}
            />
            <Button kind="subtle" onClick={addEditItem}>
              + Add Question
            </Button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Button kind="success" onClick={saveEditChecklist}>
              Save Changes
            </Button>
            <Button onClick={cancelEdit}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* RUN CHECKLIST */}
      {selectedChecklist && !adding && !editingId && (
        <Card hoverable={false}>
          <SectionTitle>
            {selectedChecklist.title}
            <span style={freqChip(selectedChecklist.frequency)}>{selectedChecklist.frequency || "Ad hoc"}</span>
          </SectionTitle>
          {renderChecklistItemsRun(true)}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Button kind="success" onClick={saveAnswers}>
              Submit Answers
            </Button>
            <Button onClick={resetView}>Back</Button>
          </div>
        </Card>
      )}

      {/* VIEW COMPLETED */}
      {viewingCompleted && !adding && !editingId && (
        <Card hoverable={false}>
          <SectionTitle>
            {viewingCompleted.title}{" "}
            {viewingCompleted.frequency && (
              <span style={freqChip(viewingCompleted.frequency)}>{viewingCompleted.frequency}</span>
            )}
            <span style={{ color: "#6b7280", fontWeight: 500, marginLeft: 8 }}>
              (Completed by {viewingCompleted.person})
            </span>
          </SectionTitle>
          {renderChecklistItemsRun(false)}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Button onClick={resetView}>Back</Button>
            <Button
              kind="warn"
              onClick={() =>
                exportChecklistToPDF(
                  viewingCompleted.title,
                  viewingCompleted.questions,
                  viewingCompleted.person,
                  viewingCompleted.createdAt
                )
              }
            >
              Export PDF
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ChecklistSection;