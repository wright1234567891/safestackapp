import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, Timestamp, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

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

  // Firestore collection references
  const checklistCollectionRef = collection(db, "checklists");
  const completedCollectionRef = collection(db, "completed");

  // Fetch checklists and completed on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const qChecklist = query(checklistCollectionRef, orderBy("createdAt", "desc"));
        const checklistSnapshot = await getDocs(qChecklist);
        const checklistData = checklistSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setChecklists(checklistData);

        const qCompleted = query(completedCollectionRef, orderBy("createdAt", "desc"));
        const completedSnapshot = await getDocs(qCompleted);
        const completedData = completedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCompleted(completedData);
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

  // Save new checklist
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
      console.log("Checklist saved:", record);
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
      // Update original checklist with latest answers
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
      console.log("Completed checklist saved:", completedEntry);
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
          <div style={{ margin: "20px 0" }}>
            <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Enter a new question" style={{ padding: "10px", fontSize: "16px", width: "300px", borderRadius: "5px" }} />
            <button onClick={addItem} style={{ padding: "10px 20px", fontSize: "16px", marginLeft: "10px", borderRadius: "5px", cursor: "pointer" }}>
              Add
            </button>
          </div>
          <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "left" }}>
            {renderChecklistItems(true)}
          </div>
          <button onClick={saveChecklist} style={{ marginTop: "30px", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>
            Save Checklist
          </button>
        </>
      )}

      {/* SELECTED CHECKLIST VIEW */}
      {selectedChecklist && (
        <>
          <h2>{selectedChecklist.title}</h2>
          <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "left" }}>
            {renderChecklistItems(true)}
          </div>
          <button onClick={saveAnswers} style={{ marginTop: "30px", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>
            Save Answers
          </button>
          <button onClick={resetView} style={{ marginTop: "10px", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>
            Back to Checklists
          </button>
        </>
      )}

      {/* VIEW COMPLETED CHECKLIST */}
      {viewingCompleted && (
        <>
          <h2>{viewingCompleted.title} (Completed by {viewingCompleted.person})</h2>
          <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "left" }}>
            {renderChecklistItems(false)}
          </div>
          <button onClick={resetView} style={{ marginTop: "20px", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>
            Back to Checklists
          </button>
        </>
      )}
    </div>
  );
};

export default ChecklistSection;