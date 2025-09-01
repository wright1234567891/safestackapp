import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, Timestamp, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const ChecklistSection = ({ goBack, site, user }) => {
  const [checklists, setChecklists] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [adding, setAdding] = useState(false);
  const [titleSet, setTitleSet] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState("");
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [viewingCompleted, setViewingCompleted] = useState(null);

  const isManager = ["Chris", "Chloe"].includes(user);

  const checklistCollectionRef = collection(db, "checklists");
  const completedCollectionRef = collection(db, "completed");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qChecklist = query(checklistCollectionRef, orderBy("createdAt", "desc"));
        const checklistSnapshot = await getDocs(qChecklist);
        setChecklists(checklistSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const qCompleted = query(completedCollectionRef, orderBy("createdAt", "desc"));
        const completedSnapshot = await getDocs(qCompleted);
        setCompleted(completedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching checklists/completed:", error);
      }
    };
    fetchData();
  }, []);

  const siteChecklists = checklists.filter(cl => cl.site === site);

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems([...items, { text: newItem, answer: null, corrective: "" }]);
    setNewItem("");
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
    if (!checklistTitle || items.length === 0) {
      alert("Checklist must have a title and at least one question");
      return;
    }

    const record = {
      site,
      title: checklistTitle,
      questions: items,
      createdAt: Timestamp.now(),
      person: user || "Unknown"
    };

    try {
      const docRef = await addDoc(checklistCollectionRef, record);
      setChecklists(prev => [{ id: docRef.id, ...record }, ...prev]);
      setChecklistTitle("");
      setItems([]);
      setTitleSet(false);
      setAdding(false);
    } catch (error) {
      console.error("Error adding checklist:", error);
    }
  };

  const deleteChecklist = async (cl) => {
    if (!window.confirm(`Delete checklist "${cl.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "checklists", cl.id));
      setChecklists(prev => prev.filter(c => c.id !== cl.id));
    } catch (error) {
      console.error("Error deleting checklist:", error);
    }
  };

  const openChecklist = (cl) => {
    const freshQuestions = cl.questions.map(q => ({ ...q, answer: null, corrective: "" }));
    setSelectedChecklist(cl);
    setItems(freshQuestions);
  };

  const saveAnswers = async () => {
    if (!selectedChecklist) return;

    try {
      await updateDoc(doc(db, "checklists", selectedChecklist.id), { questions: items });

      const now = Timestamp.now();
      const completedEntry = {
        title: selectedChecklist.title,
        person: user || "Unknown",
        questions: items,
        site,
        createdAt: now
      };

      const docRef = await addDoc(completedCollectionRef, completedEntry);
      setCompleted(prev => [{ id: docRef.id, ...completedEntry }, ...prev]);
      setSelectedChecklist(null);
      setItems([]);
    } catch (error) {
      console.error("Error saving answers:", error);
    }
  };

  const deleteCompleted = async (entry) => {
    if (!window.confirm(`Delete completed checklist "${entry.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "completed", entry.id));
      setCompleted(prev => prev.filter(c => c.id !== entry.id));
    } catch (error) {
      console.error("Error deleting completed:", error);
    }
  };

  const viewCompleted = (c) => {
    setViewingCompleted(c);
    setItems(c.questions.map(q => ({ ...q })));
  };

  const resetView = () => {
    setSelectedChecklist(null);
    setViewingCompleted(null);
    setItems([]);
  };

  const renderChecklistItems = (editable = true) =>
    items.map((item, index) => (
      <div key={index} style={{ margin: "10px 0", padding: "10px", backgroundColor: "#fff", borderRadius: "8px", color: "#000" }}>
        <p>{item.text}</p>
        <label style={{ marginRight: "10px" }}>
          <input
            type="radio"
            name={`q-${index}`}
            checked={item.answer === "Yes"}
            onChange={editable ? () => handleAnswerChange(index, "Yes") : undefined}
            readOnly={!editable}
          /> Yes
        </label>
        <label>
          <input
            type="radio"
            name={`q-${index}`}
            checked={item.answer === "No"}
            onChange={editable ? () => handleAnswerChange(index, "No") : undefined}
            readOnly={!editable}
          /> No
        </label>
        {item.answer === "No" && (
          <input
            type="text"
            placeholder="Corrective action"
            value={item.corrective}
            onChange={editable ? (e) => handleCorrectiveChange(index, e.target.value) : undefined}
            readOnly={!editable}
            style={{ marginTop: "10px", padding: "8px", borderRadius: "5px", width: "100%" }}
          />
        )}
      </div>
    ));

  const exportChecklistToPDF = async (title, questions) => {
    const element = document.createElement("div");
    element.style.padding = "20px";
    element.style.backgroundColor = "#fff";
    element.style.color = "#000";
    element.style.width = "500px";

    const titleEl = document.createElement("h2");
    titleEl.innerText = title;
    element.appendChild(titleEl);

    questions.forEach((q, idx) => {
      const qEl = document.createElement("p");
      qEl.innerText = `${idx + 1}. ${q.text} - Answer: ${q.answer || "N/A"}${q.answer === "No" && q.corrective ? ` - Corrective: ${q.corrective}` : ""}`;
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

  // --- NEW FUNCTION: Export ALL completed checklists ---
  const exportAllCompletedToPDF = async () => {
    if (completed.length === 0) {
      alert("No completed checklists to export");
      return;
    }

    const element = document.createElement("div");
    element.style.padding = "20px";
    element.style.backgroundColor = "#fff";
    element.style.color = "#000";
    element.style.width = "500px";

    const titleEl = document.createElement("h2");
    titleEl.innerText = `${site} - All Completed Checklists`;
    element.appendChild(titleEl);

    completed.forEach((c, cIdx) => {
      const subTitle = document.createElement("h3");
      subTitle.innerText = `${cIdx + 1}. ${c.title} (Completed by ${c.person})`;
      element.appendChild(subTitle);

      c.questions.forEach((q, idx) => {
        const qEl = document.createElement("p");
        qEl.innerText = `${idx + 1}. ${q.text} - Answer: ${q.answer || "N/A"}${q.answer === "No" && q.corrective ? ` - Corrective: ${q.corrective}` : ""}`;
        element.appendChild(qEl);
      });

      element.appendChild(document.createElement("hr")); // separator
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

  return (
    <div style={{ padding: "30px", textAlign: "center" }}>
      <h1 style={{ color: "#1a4a4c" }}>{site} - Checklists</h1>

      {/* MAIN VIEW */}
      {!adding && !selectedChecklist && !viewingCompleted && (
        <>
          {isManager && (
            <button onClick={() => setAdding(true)} style={{ padding: "10px 20px", fontSize: "16px", borderRadius: "8px", cursor: "pointer", margin: "10px" }}>
              Add Checklist
            </button>
          )}

          {siteChecklists.length === 0 && <p>No checklists yet</p>}

          {siteChecklists.map((cl, i) => (
            <div key={i} style={{ position: "relative", backgroundColor: "#fff", color: "#000", padding: "10px", margin: "10px auto", maxWidth: "600px", borderRadius: "8px", cursor: "pointer" }}>
              <div onClick={() => openChecklist(cl)}>
                <h3>{cl.title}</h3>
                <p>{cl.questions.length} questions</p>
              </div>
              {isManager && (
                <button onClick={() => deleteChecklist(cl)} style={{ position: "absolute", top: "10px", right: "10px", backgroundColor: "#ff4d4d", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "5px", cursor: "pointer" }}>
                  Delete
                </button>
              )}
            </div>
          ))}

          <button onClick={goBack} style={{ marginTop: "30px", padding: "10px 20px", fontSize: "16px", borderRadius: "8px", cursor: "pointer" }}>
            Back
          </button>

          {completed.length > 0 && (
            <>
              <h2 style={{ marginTop: "40px" }}>Completed Checklists</h2>
              <button
                onClick={exportAllCompletedToPDF}
                style={{ marginBottom: "20px", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}
              >
                Export All Completed Checklists
              </button>
              {completed.map((c, idx) => (
                <div key={idx} style={{ position: "relative", cursor: "pointer", backgroundColor: "#f0f0f0", color: "#000", padding: "10px", margin: "10px auto", maxWidth: "600px", borderRadius: "8px" }} onClick={() => viewCompleted(c)}>
                  <p><strong>{c.title}</strong></p>
                  <p>Person: {c.person}</p>
                  {isManager && (
                    <button onClick={(e) => { e.stopPropagation(); deleteCompleted(c); }} style={{ position: "absolute", top: "10px", right: "10px", backgroundColor: "#ff4d4d", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "5px", cursor: "pointer" }}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* ADD CHECKLIST VIEW */}
      {adding && !titleSet && (
        <>
          <input type="text" value={checklistTitle} onChange={(e) => setChecklistTitle(e.target.value)} placeholder="Enter checklist title e.g. Opening Checks" style={{ padding: "10px", fontSize: "16px", width: "300px", borderRadius: "5px" }} />
          <br />
          <button onClick={() => checklistTitle.trim() !== "" && setTitleSet(true)} style={{ marginTop: "20px", padding: "10px 20px", fontSize: "16px", borderRadius: "5px", cursor: "pointer" }}>
            Start Adding Questions
          </button>
          <br />
          <button onClick={() => setAdding(false)} style={{ marginTop: "15px", padding: "10px 20px", fontSize: "14px", borderRadius: "5px", cursor: "pointer" }}>
            Cancel
          </button>
        </>
      )}

      {adding && titleSet && (
        <>
          <h2>{checklistTitle}</h2>
          <div style