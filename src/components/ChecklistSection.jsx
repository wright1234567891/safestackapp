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

const ChecklistSection = ({ goBack, site, user }) => {
  const [checklists, setChecklists] = useState([]);
  const [completed, setCompleted] = useState([]);

  // Authoring state
  const [adding, setAdding] = useState(false);
  const [titleSet, setTitleSet] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState("");
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");

  // keep focus steady on the “new question” field
  const newItemRef = useRef(null);

  // Working state
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [viewingCompleted, setViewingCompleted] = useState(null);

  // Adjust if user is an object in your app; this mirrors your current approach.
  const isManager = ["Chris", "Chloe"].includes(user);

  // Firestore refs
  const checklistCollectionRef = collection(db, "checklists");
  const completedCollectionRef = collection(db, "completed");

  // ---------- Fetch ----------
  useEffect(() => {
    const fetchData = async () => {
      try {
        const qChecklist = query(
          checklistCollectionRef,
          orderBy("createdAt", "desc")
        );
        const checklistSnapshot = await getDocs(qChecklist);
        setChecklists(
          checklistSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        );

        const qCompleted = query(
          completedCollectionRef,
          orderBy("createdAt", "desc")
        );
        const completedSnapshot = await getDocs(qCompleted);
        setCompleted(
          completedSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      } catch (error) {
        console.error("Error fetching checklists/completed:", error);
      }
    };
    fetchData();
  }, []);

  const siteChecklists = checklists.filter((cl) => cl.site === site);

  // ---------- Focus helpers ----------
  // Focus the "new question" input when you land on the questions step
  useEffect(() => {
    if (adding && titleSet) {
      // slight delay ensures the element exists after re-render
      requestAnimationFrame(() => newItemRef.current?.focus());
    }
  }, [adding, titleSet]);

  // Keep focus while typing (some environments blur on re-render)
  useEffect(() => {
    if (adding && titleSet) {
      requestAnimationFrame(() => {
        // Only re-focus if the input exists and isn't already focused
        if (newItemRef.current && document.activeElement !== newItemRef.current) {
          newItemRef.current.focus();
          // put cursor at end (some mobile keyboards can move caret)
          const len = newItemRef.current.value?.length ?? 0;
          try {
            newItemRef.current.setSelectionRange(len, len);
          } catch {}
        }
      });
    }
  }, [newItem, adding, titleSet]);

  // ---------- Authoring ----------
  const addItem = () => {
    if (!newItem.trim()) return;
    setItems((prev) => [
      ...prev,
      { text: newItem.trim(), answer: null, corrective: "" },
    ]);
    setNewItem("");
    // Return focus to the input so you can keep adding questions quickly
    requestAnimationFrame(() => newItemRef.current?.focus());
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

  const saveChecklist = async () => {
    if (!checklistTitle.trim() || items.length === 0) {
      alert("Checklist must have a title and at least one question");
      return;
    }

    const record = {
      site,
      title: checklistTitle.trim(),
      questions: items,
      createdAt: Timestamp.now(),
      person: user || "Unknown",
    };

    try {
      const docRef = await addDoc(checklistCollectionRef, record);
      setChecklists((prev) => [{ id: docRef.id, ...record }, ...prev]);
      setChecklistTitle("");
      setItems([]);
      setTitleSet(false);
      setAdding(false);
    } catch (error) {
      console.error("Error adding checklist:", error);
    }
  };

  const deleteChecklist = async (cl) => {
    if (
      !window.confirm(
        `Delete checklist "${cl.title}"? This cannot be undone.`
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "checklists", cl.id));
      setChecklists((prev) => prev.filter((c) => c.id !== cl.id));
    } catch (error) {
      console.error("Error deleting checklist:", error);
    }
  };

  const openChecklist = (cl) => {
    const freshQuestions = cl.questions.map((q) => ({
      ...q,
      answer: null,
      corrective: "",
    }));
    setSelectedChecklist(cl);
    setItems(freshQuestions);
  };

  // ---------- Completing ----------
  const saveAnswers = async () => {
    if (!selectedChecklist) return;

    try {
      // Persist the answered questions back into the checklist
      await updateDoc(doc(db, "checklists", selectedChecklist.id), {
        questions: items,
      });

      // And also add a record to "completed"
      const now = Timestamp.now();
      const completedEntry = {
        title: selectedChecklist.title,
        person: user || "Unknown",
        questions: items,
        site,
        createdAt: now,
      };

      const docRef = await addDoc(completedCollectionRef, completedEntry);
      setCompleted((prev) => [{ id: docRef.id, ...completedEntry }, ...prev]);

      setSelectedChecklist(null);
      setItems([]);
    } catch (error) {
      console.error("Error saving answers:", error);
    }
  };

  const deleteCompleted = async (entry) => {
    if (
      !window.confirm(
        `Delete completed checklist "${entry.title}"? This cannot be undone.`
      )
    )
      return;
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
    setSelectedChecklist(null);
    setViewingCompleted(null);
    setItems([]);
    setAdding(false);
    setTitleSet(false);
    setChecklistTitle("");
    setNewItem("");
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
    subTitleEl.innerText = `Completed by: ${completedBy} — ${formatTimestamp(
      ts
    )}`;
    subTitleEl.style.margin = "0 0 16px 0";
    element.appendChild(subTitleEl);

    questions.forEach((q, idx) => {
      const qEl = document.createElement("p");
      qEl.style.margin = "0 0 8px 0";
      qEl.innerText = `${idx + 1}. ${q.text} — Answer: ${
        q.answer || "N/A"
      }${q.answer === "No" && q.corrective ? ` — Corrective: ${q.corrective}` : ""}`;
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
    if (completed.length === 0) {
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

    completed.forEach((c, cIdx) => {
      const subTitle = document.createElement("h3");
      subTitle.innerText = `${cIdx + 1}. ${c.title} (Completed by ${
        c.person
      } at ${formatTimestamp(c.createdAt)})`;
      subTitle.style.margin = "16px 0 8px 0";
      element.appendChild(subTitle);

      c.questions.forEach((q, idx) => {
        const qEl = document.createElement("p");
        qEl.style.margin = "0 0 6px 0";
        qEl.innerText = `${idx + 1}. ${q.text} — Answer: ${
          q.answer || "N/A"
        }${q.answer === "No" && q.corrective ? ` — Corrective: ${q.corrective}` : ""}`;
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

  // ---------- UI pieces ----------
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
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = p.hover)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = p.bg)
        }
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

  const renderChecklistItems = (editable = true) =>
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
                onClick={
                  editable ? () => handleAnswerChange(index, "Yes") : undefined
                }
                style={{
                  border: yesActive ? "1px solid #059669" : "1px solid #e5e7eb",
                }}
              >
                Yes
              </Button>
              <Button
                kind={noActive ? "danger" : "subtle"}
                onClick={
                  editable ? () => handleAnswerChange(index, "No") : undefined
                }
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
              onChange={
                editable
                  ? (e) => handleCorrectiveChange(index, e.target.value)
                  : undefined
              }
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
            Create, complete, and export your venue checklists
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={goBack}>Back</Button>
          {isManager && (
            <Button
              kind="primary"
              onClick={() => {
                setAdding(true);
                setSelectedChecklist(null);
                setViewingCompleted(null);
                // ensure focus goes to title first
                requestAnimationFrame(() => {
                  // no-op here; title field will be first interactive element
                });
              }}
            >
              + Add Checklist
            </Button>
          )}
          {completed.length > 0 && (
            <Button kind="warn" onClick={exportAllCompletedToPDF}>
              Export All Completed
            </Button>
          )}
        </div>
      </div>

      {/* MAIN VIEW */}
      {!adding && !selectedChecklist && !viewingCompleted && (
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
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            {siteChecklists.map((cl) => (
              <Card key={cl.id} onClick={() => openChecklist(cl)}>
                <div style={{ paddingRight: 64 }}>
                  <div
                    style={{ fontWeight: 700, color: "#111", marginBottom: 6 }}
                  >
                    {cl.title}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {cl.questions.length} question
                    {cl.questions.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {isManager && (
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
                )}
              </Card>
            ))}
          </div>

          {completed.length > 0 && (
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
                {completed.map((c) => (
                  <Card key={c.id} onClick={() => viewCompleted(c)}>
                    <div style={{ paddingRight: 64 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#111",
                          marginBottom: 4,
                        }}
                      >
                        {c.title}
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
      {adding && !titleSet && (
        <Card hoverable={false}>
          <SectionTitle>New Checklist</SectionTitle>
          <div style={{ color: "#6b7280", marginBottom: 10 }}>
            Give your checklist a clear, descriptive title.
          </div>
          <input
            type="text"
            value={checklistTitle}
            onChange={(e) => setChecklistTitle(e.target.value)}
            placeholder="e.g. Opening Checks"
            style={{
              padding: "12px 14px",
              fontSize: "15px",
              width: "100%",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              outline: "none",
            }}
          />
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

      {/* ADD CHECKLIST — QUESTIONS STEP */}
      {adding && titleSet && (
        <Card hoverable={false}>
          <SectionTitle>{checklistTitle}</SectionTitle>
          <div style={{ color: "#6b7280", marginBottom: 10 }}>
            Add your questions, mark expected answers when you use the
            checklist, and include corrective actions if needed.
          </div>

          {renderChecklistItems()}

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
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
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
            <Button kind="subtle" onClick={addItem}>
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

      {/* RUN CHECKLIST */}
      {selectedChecklist && (
        <Card hoverable={false}>
          <SectionTitle>{selectedChecklist.title}</SectionTitle>
          {renderChecklistItems(true)}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Button kind="success" onClick={saveAnswers}>
              Submit Answers
            </Button>
            <Button onClick={resetView}>Back</Button>
          </div>
        </Card>
      )}

      {/* VIEW COMPLETED */}
      {viewingCompleted && (
        <Card hoverable={false}>
          <SectionTitle>
            {viewingCompleted.title}{" "}
            <span style={{ color: "#6b7280", fontWeight: 500 }}>
              (Completed by {viewingCompleted.person})
            </span>
          </SectionTitle>
          {renderChecklistItems(false)}
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