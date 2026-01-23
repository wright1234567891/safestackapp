// src/components/ChecklistSection.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  query,
  orderBy,
  where,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ---------- Helpers ----------
const formatTimestamp = (ts) => {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
  return d ? d.toLocaleString() : "";
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
const makeId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `q_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
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
      return { ...base, background: "#e5e7eb", color: "#111827" };
  }
};

const tinyDraftChip = {
  marginLeft: 6,
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fed7aa",
  display: "inline-block",
};

// NEW: Utilities for new schema with sensible defaults (backward-compatible)
const withQuestionDefaults = (q) => {
  return {
    id: q?.id ?? makeId(),           // ✅ STABLE ID
    text: q?.text ?? "",
    enabled: q?.enabled ?? true,     // ✅ FUTURE SITE OVERRIDES
    answer: q?.answer ?? null,
    corrective: q?.corrective ?? "",
    correctiveOn: q?.correctiveOn ?? "no",
    followUps: {
      yes: {
        enabled: q?.followUps?.yes?.enabled ?? false,
        text: q?.followUps?.yes?.text ?? "",
        correctiveOn: q?.followUps?.yes?.correctiveOn ?? "no",
      },
      no: {
        enabled: q?.followUps?.no?.enabled ?? false,
        text: q?.followUps?.no?.text ?? "",
        correctiveOn: q?.followUps?.no?.correctiveOn ?? "no",
      },
    },
    followUpAnswers: {
      yes: {
        answer: q?.followUpAnswers?.yes?.answer ?? null,
        corrective: q?.followUpAnswers?.yes?.corrective ?? "",
      },
      no: {
        answer: q?.followUpAnswers?.no?.answer ?? null,
        corrective: q?.followUpAnswers?.no?.corrective ?? "",
      },
    },
  };
};

const needsCorrective = (rule, ans) => {
  if (!ans) return false;
  switch (rule) {
    case "yes":
      return ans === "Yes";
    case "no":
      return ans === "No";
    case "both":
      return ans === "Yes" || ans === "No";
    default:
      return false; // "none"
  }
};

// ---------- Component ----------
const ChecklistSection = ({ goBack, site, user }) => {
  const [checklists, setChecklists] = useState([]);
  const [completed, setCompleted] = useState([]);

  // DRAFTS
  const [drafts, setDrafts] = useState([]); // list of draft docs
  const [draftMap, setDraftMap] = useState({}); // checklistId -> draft

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

  const newItemRef = useRef(null);
  const editNewItemRef = useRef(null);

  // Working state (Run / View)
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [viewingCompleted, setViewingCompleted] = useState(null);

  // Track a draft id while running a checklist
  const [draftId, setDraftId] = useState(null);

// Adjust to your auth model if user is an object

const uid = user?.uid || null;
const personName = user?.displayName || user?.email || "Unknown";
const [role, setRole] = useState("staff");
const isManager = role === "manager";

// ...

const uid = user?.uid || null;
const personName = user?.displayName || user?.email || "Unknown";
const [role, setRole] = useState("staff");
const isManager = role === "manager";

useEffect(() => {
  let ignore = false;

  async function loadRole() {
    if (!uid) {
      setRole("staff");
      return;
    }
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.exists() ? snap.data() : null;
      if (!ignore) setRole(data?.role === "manager" ? "manager" : "staff");
    } catch {
      if (!ignore) setRole("staff");
    }
  }

  loadRole();
  return () => { ignore = true; };
}, [uid]);

  // Firestore refs
  const checklistCollectionRef = collection(db, "checklists");
  const completedCollectionRef = collection(db, "completed");
  const draftsCollectionRef = collection(db, "checklistDrafts");

  // ---------- shared draft refresher ----------
  const refreshDrafts = async () => {
    try {
      const qDrafts = query(
        draftsCollectionRef,
        where("site", "==", site),
        where("person", "==", personName)
      );
      const snap = await getDocs(qDrafts);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      setDrafts(list);
      const m = {};
      list.forEach((d) => {
        if (d.checklistId) m[d.checklistId] = d;
      });
      setDraftMap(m);
    } catch (e) {
      console.warn("Error refreshing drafts:", e?.message);
      setDrafts([]);
      setDraftMap({});
    }
  };

  // ---------- Fetch (site-scoped + reacts to site change) ----------
  useEffect(() => {
    if (!site) return;

    const fetchData = async () => {
      // Checklists
      try {
        const qChecklist = query(
          checklistCollectionRef,
          where("site", "==", site),
          orderBy("createdAt", "desc")
        );
        const checklistSnapshot = await getDocs(qChecklist);
        setChecklists(
          checklistSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      } catch {
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

      // Completed
      try {
        const qCompleted = query(
          completedCollectionRef,
          where("site", "==", site),
          orderBy("createdAt", "desc")
        );
        const completedSnapshot = await getDocs(qCompleted);
        setCompleted(
          completedSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      } catch {
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

      await refreshDrafts();
    };

    fetchData();
    resetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, personName]);

  const siteChecklists = checklists;
  const siteCompleted = completed;

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
const newQuestion = (text = "") =>
  withQuestionDefaults({
    id: makeId(),           // ✅ CREATE ID ONCE
    text,
    enabled: true,
    answer: null,
    corrective: "",
    correctiveOn: "no",
    followUps: {
      yes: { enabled: false, text: "", correctiveOn: "no" },
      no: { enabled: false, text: "", correctiveOn: "no" },
    },
    followUpAnswers: {
      yes: { answer: null, corrective: "" },
      no: { answer: null, corrective: "" },
    },
  });

  const addItemAuthor = () => {
    if (!newItem.trim()) return;
    setItems((prev) => [...prev, newQuestion(newItem.trim())]);
    setNewItem("");
    requestAnimationFrame(() => newItemRef.current?.focus());
  };

  const updateItemAuthor = (index, updater) => {
    const updated = [...items];
    const current = withQuestionDefaults(updated[index]);
    updated[index] = typeof updater === "function" ? updater(current) : updater;
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
      questions: items.map(withQuestionDefaults),
      createdAt: Timestamp.now(),
      person: personName,
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
    setEditItems(
      (Array.isArray(cl.questions) ? cl.questions : []).map(withQuestionDefaults)
    );
    setAdding(false);
    setTitleSet(false);
    setSelectedChecklist(null);
    setViewingCompleted(null);
    setDraftId(null);
  };

  const addEditItem = () => {
    if (!editNewItem.trim()) return;
    setEditItems((prev) => [...prev, newQuestion(editNewItem.trim())]);
    setEditNewItem("");
    requestAnimationFrame(() => editNewItemRef.current?.focus());
  };

  const updateEditItem = (index, updater) => {
    const updated = [...editItems];
    const current = withQuestionDefaults(updated[index]);
    updated[index] = typeof updater === "function" ? updater(current) : updater;
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
        questions: editItems.map(withQuestionDefaults),
        updatedAt: Timestamp.now(),
        updatedBy: personName,
      });
      setChecklists((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? {
                ...c,
                title: editTitle.trim(),
                frequency: editFrequency || "Ad hoc",
                questions: editItems.map(withQuestionDefaults),
              }
            : c
        )
      );
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

  // ---------- Draft helpers ----------
  const refreshDraftsForPerson = async () => {
    await refreshDrafts();
  };

  const loadLatestDraft = async (cl) => {
    try {
      const qDraft = query(
        draftsCollectionRef,
        where("site", "==", site),
        where("checklistId", "==", cl.id),
        where("person", "==", personName),
        orderBy("updatedAt", "desc"),
        limit(1)
      );
      const snap = await getDocs(qDraft);
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        if (Array.isArray(data.questions)) {
          setItems(data.questions.map(withQuestionDefaults));
          setDraftId(d.id);
        } else {
          setDraftId(null);
        }
      } else {
        setDraftId(null);
      }
    } catch (e) {
      console.warn("Could not load draft:", e?.message);
      setDraftId(null);
    }
  };

  const saveDraft = async () => {
    if (!selectedChecklist) return;

    const base = {
      site,
      checklistId: selectedChecklist.id,
      title: selectedChecklist.title,
      person: personName,
      questions: items.map(withQuestionDefaults),
      frequency: selectedChecklist.frequency || "Ad hoc",
      status: "draft",
    };

    try {
      if (draftId) {
        // UPDATE
        await updateDoc(doc(db, "checklistDrafts", draftId), {
          ...base,
          updatedAt: Timestamp.now(),
        });
      } else {
        // CREATE
        const ref = await addDoc(draftsCollectionRef, {
          ...base,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        setDraftId(ref.id);
      }
      await refreshDraftsForPerson();
      alert("Draft saved.");
    } catch (e) {
      console.error("Error saving draft:", e);
      alert("Could not save draft.");
    }
  };

  const discardDraft = async () => {
    try {
      if (draftId) {
        await deleteDoc(doc(db, "checklistDrafts", draftId));
        setDraftId(null);
      }
      await refreshDraftsForPerson();
    } catch (e) {
      console.error("Error discarding draft:", e);
    }
  };

  // ---------- Running (complete answers) ----------
  const openChecklist = async (cl) => {
    // Ensure defaults for runtime
    const freshQuestions = (cl.questions || []).map((q) =>
      withQuestionDefaults({
        ...q,
        answer: null,
        corrective: "",
        followUpAnswers: {
          yes: { answer: null, corrective: "" },
          no: { answer: null, corrective: "" },
        },
      })
    );
    setSelectedChecklist(cl);
    setItems(freshQuestions);
    setAdding(false);
    setTitleSet(false);
    setEditingId(null);
    setViewingCompleted(null);
    setDraftId(null);

    await loadLatestDraft(cl);
  };

  const resumeDraft = async (draft) => {
    const cl = siteChecklists.find((c) => c.id === draft.checklistId);
    if (cl) {
      setSelectedChecklist(cl);
    } else {
      setSelectedChecklist({
        id: draft.checklistId,
        title: draft.title || "Checklist",
        frequency: draft.frequency || "Ad hoc",
      });
    }
    setItems((draft.questions || []).map(withQuestionDefaults));
    setAdding(false);
    setTitleSet(false);
    setEditingId(null);
    setViewingCompleted(null);
    setDraftId(draft.id);
  };

  const handleAnswerChange = (index, value) => {
    const updated = [...items];
    const item = withQuestionDefaults(updated[index]);
    item.answer = value;

    // If switching answer, clear follow-up answers for the other branch (to avoid stale data)
    if (value === "Yes") {
      item.followUpAnswers.no = { answer: null, corrective: "" };
    } else if (value === "No") {
      item.followUpAnswers.yes = { answer: null, corrective: "" };
    } else if (value === "N/A") {
      item.followUpAnswers.yes = { answer: null, corrective: "" };
      item.followUpAnswers.no = { answer: null, corrective: "" };
    }

    // Optional: auto-clear main corrective if not required
    if (!needsCorrective(item.correctiveOn, value)) {
      item.corrective = "";
    }
    updated[index] = item;
    setItems(updated);
  };

  const handleCorrectiveChange = (index, value) => {
    const updated = [...items];
    const item = withQuestionDefaults(updated[index]);
    item.corrective = value;
    updated[index] = item;
    setItems(updated);
  };

  // Follow-up handlers
  const handleFollowUpAnswer = (index, branch /* "yes"|"no" */, value) => {
    const updated = [...items];
    const item = withQuestionDefaults(updated[index]);
    const fa = { ...(item.followUpAnswers?.[branch] ?? { answer: null, corrective: "" }) };
    fa.answer = value;
    if (!needsCorrective(item.followUps[branch].correctiveOn, value)) {
      fa.corrective = "";
    }
    item.followUpAnswers = { ...item.followUpAnswers, [branch]: fa };
    updated[index] = item;
    setItems(updated);
  };

  const handleFollowUpCorrective = (index, branch, value) => {
    const updated = [...items];
    const item = withQuestionDefaults(updated[index]);
    const fa = { ...(item.followUpAnswers?.[branch] ?? { answer: null, corrective: "" }) };
    fa.corrective = value;
    item.followUpAnswers = { ...item.followUpAnswers, [branch]: fa };
    updated[index] = item;
    setItems(updated);
  };

  const saveAnswers = async () => {
    if (!selectedChecklist) return;

    try {
      // stamp metadata on the template
      await updateDoc(doc(db, "checklists", selectedChecklist.id), {
        lastCompletedAt: Timestamp.now(),
        lastCompletedBy: personName,
      });

      const now = Timestamp.now();
      const completedEntry = {
        checklistId: selectedChecklist.id,
        title: selectedChecklist.title,
        person: personName,
        questions: items.map(withQuestionDefaults),
        site,
        createdAt: now,
        frequency: selectedChecklist.frequency || "Ad hoc",
      };

      const docRef = await addDoc(completedCollectionRef, completedEntry);
      setCompleted((prev) => [{ id: docRef.id, ...completedEntry }, ...prev]);

      // clean up draft for this run
      if (draftId) {
        await deleteDoc(doc(db, "checklistDrafts", draftId));
        setDraftId(null);
      }
      await refreshDraftsForPerson();

      setSelectedChecklist(null);
      setItems([]);
    } catch (error) {
      console.error("Error saving answers:", error);
      alert("Could not submit answers. Please try again.");
    }
  };

  const deleteChecklist = async (cl) => {
    if (!window.confirm(`Delete checklist "${cl.title}"? This cannot be undone.`))
      return;
    try {
      await deleteDoc(doc(db, "checklists", cl.id));
      setChecklists((prev) => prev.filter((c) => c.id !== cl.id));

      // If there was a draft for this checklist, also remove it locally
      if (draftMap[cl.id]) {
        try {
          await deleteDoc(doc(db, "checklistDrafts", draftMap[cl.id].id));
        } catch {}
        const updatedDrafts = drafts.filter((d) => d.checklistId !== cl.id);
        setDrafts(updatedDrafts);
        const m = {};
        updatedDrafts.forEach((d) => (m[d.checklistId] = d));
        setDraftMap(m);
      }
    } catch (error) {
      console.error("Error deleting checklist:", error);
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
    setItems(c.questions.map(withQuestionDefaults));
    setSelectedChecklist(null);
    setDraftId(null);
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
    setDraftId(null);
    // Edit
    setEditingId(null);
    setEditTitle("");
    setEditFrequency("Ad hoc");
    setEditItems([]);
    setEditNewItem("");
  };

  // ---------- Export ----------
  // Recursively write a question and (if present) its relevant follow-up
  const writeQuestionBlock = (container, q, idx) => {
    const qEl = document.createElement("p");
    qEl.style.margin = "0 0 8px 0";
    const ans = q.answer || "N/A";
    const corrMain =
      needsCorrective(q.correctiveOn, q.answer) && q.corrective
        ? ` — Corrective: ${q.corrective}`
        : "";
    qEl.innerText = `${idx + 1}. ${q.text} — Answer: ${ans}${corrMain}`;
    container.appendChild(qEl);

    if (q.answer === "Yes" && q.followUps?.yes?.enabled && q.followUps.yes.text) {
      const f = q.followUps.yes;
      const fa = q.followUpAnswers?.yes ?? {};
      const sub = document.createElement("p");
      sub.style.margin = "0 0 6px 18px";
      const fCorr =
        needsCorrective(f.correctiveOn, fa.answer) && fa.corrective
          ? ` — Corrective: ${fa.corrective}`
          : "";
      sub.innerText = `↳ ${f.text} — Answer: ${fa.answer || "N/A"}${fCorr}`;
      container.appendChild(sub);
    } else if (q.answer === "No" && q.followUps?.no?.enabled && q.followUps.no.text) {
      const f = q.followUps.no;
      const fa = q.followUpAnswers?.no ?? {};
      const sub = document.createElement("p");
      sub.style.margin = "0 0 6px 18px";
      const fCorr =
        needsCorrective(f.correctiveOn, fa.answer) && fa.corrective
          ? ` — Corrective: ${fa.corrective}`
          : "";
      sub.innerText = `↳ ${f.text} — Answer: ${fa.answer || "N/A"}${fCorr}`;
      container.appendChild(sub);
    }
  };

  const exportChecklistToPDF = async (
    title,
    questions,
    completedBy = personName,
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
      writeQuestionBlock(element, withQuestionDefaults(q), idx);
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
      subTitle.innerText = `${cIdx + 1}. ${c.title} (Completed by ${
        c.person
      } at ${formatTimestamp(c.createdAt)})`;
      subTitle.style.margin = "16px 0 8px 0";
      element.appendChild(subTitle);

      (c.questions || []).forEach((q, idx) => {
        writeQuestionBlock(element, withQuestionDefaults(q), idx);
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

  // ---------- Small UI helpers ----------
  const CorrectiveRuleSelect = ({ value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "8px 10px",
        fontSize: "13px",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        background: "#fff",
      }}
    >
      <option value="none">Corrective: None</option>
      <option value="yes">Corrective: On Yes</option>
      <option value="no">Corrective: On No</option>
      <option value="both">Corrective: Yes or No</option>
    </select>
  );

  const AnswerButtons = ({ active, onPick }) => (
    <div style={{ display: "flex", gap: 8 }}>
      <Button
        kind={active === "Yes" ? "success" : "subtle"}
        onClick={() => onPick("Yes")}
        style={{ border: active === "Yes" ? "1px solid #059669" : "1px solid #e5e7eb" }}
      >
        Yes
      </Button>
      <Button
        kind={active === "No" ? "danger" : "subtle"}
        onClick={() => onPick("No")}
        style={{ border: active === "No" ? "1px solid #ef4444" : "1px solid #e5e7eb" }}
      >
        No
      </Button>
      <Button
        kind={active === "N/A" ? "neutral" : "subtle"}
        onClick={() => onPick("N/A")}
        style={{ border: active === "N/A" ? "1px solid #9ca3af" : "1px solid #e5e7eb" }}
      >
        N/A
      </Button>
    </div>
  );

  // ---------- Render helpers ----------
  const renderFollowUpRun = (item, index, branch, editable) => {
    const cfg = item.followUps?.[branch];
    if (!cfg?.enabled || !cfg?.text) return null;

    const ans = item.followUpAnswers?.[branch]?.answer ?? null;
    const correctiveVal = item.followUpAnswers?.[branch]?.corrective ?? "";

    return (
      <div style={{ marginTop: 10, paddingLeft: 14, borderLeft: "3px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, color: "#111" }}>↳ {cfg.text}</div>
          <AnswerButtons
            active={ans}
            onPick={editable ? (value) => handleFollowUpAnswer(index, branch, value) : () => {}}
          />
        </div>
        {needsCorrective(cfg.correctiveOn, ans) && (
          <input
            type="text"
            placeholder="Corrective action"
            value={correctiveVal}
            onChange={
              editable ? (e) => handleFollowUpCorrective(index, branch, e.target.value) : undefined
            }
            readOnly={!editable}
            style={{
              marginTop: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              width: "100%",
              border: "1px solid #e5e7eb",
              outline: "none",
              fontSize: "14px",
            }}
          />
        )}
      </div>
    );
  };

  const renderChecklistItemsRun = (editable = true) =>
    items.map((itemRaw, index) => {
      const item = withQuestionDefaults(itemRaw);
      const ans = item.answer;
      return (
        <Card key={item.id || index} hoverable={false} style={{ margin: "10px 0" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1, color: "#111" }}>{item.text}</div>
            <AnswerButtons active={ans} onPick={editable ? (v) => handleAnswerChange(index, v) : () => {}} />
          </div>

          {needsCorrective(item.correctiveOn, ans) && (
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

          {/* Follow-up branching */}
          {ans === "Yes" && renderFollowUpRun(item, index, "yes", editable)}
          {ans === "No" && renderFollowUpRun(item, index, "no", editable)}
        </Card>
      );
    });

  const renderAuthoringItems = (list, onUpdate, onRemove) =>
    list.map((raw, index) => {
      const item = withQuestionDefaults(raw);
      return (
        <Card key={item.id || index} hoverable={false} style={{ margin: "10px 0" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              value={item.text}
              onChange={(e) => onUpdate(index, { ...item, text: e.target.value })}
              placeholder={`Question ${index + 1}`}
              style={{
                padding: "12px 14px",
                fontSize: "15px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                outline: "none",
                flex: 1,
                minWidth: 240,
              }}
            />
            <CorrectiveRuleSelect
              value={item.correctiveOn}
              onChange={(val) => onUpdate(index, { ...item, correctiveOn: val })}
            />
            <Button kind="danger" onClick={() => onRemove(index)} style={{ padding: "10px 12px" }}>
              Remove
            </Button>
          </div>

          {/* Follow-up config */}
          <div
            style={{
              marginTop: 10,
              padding: "10px",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: 13, color: "#374151", fontWeight: 700, marginBottom: 8 }}>
              Follow-up (optional)
            </div>

            {/* On YES */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 13, color: "#111", minWidth: 80 }}>On Yes:</label>
              <input
                type="text"
                value={item.followUps.yes.text}
                onChange={(e) =>
                  onUpdate(index, {
                    ...item,
                    followUps: {
                      ...item.followUps,
                      yes: { ...item.followUps.yes, text: e.target.value },
                    },
                  })
                }
                placeholder="Follow-up question to ask when answer is Yes"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  id={`yes-enabled-${index}`}
                  type="checkbox"
                  checked={item.followUps.yes.enabled}
                  onChange={(e) =>
                    onUpdate(index, {
                      ...item,
                      followUps: {
                        ...item.followUps,
                        yes: { ...item.followUps.yes, enabled: e.target.checked },
                      },
                    })
                  }
                />
                <label htmlFor={`yes-enabled-${index}`} style={{ fontSize: 12 }}>
                  Enable
                </label>
              </div>
              <div />
              <div style={{ gridColumn: "2 / span 2" }}>
                <CorrectiveRuleSelect
                  value={item.followUps.yes.correctiveOn}
                  onChange={(val) =>
                    onUpdate(index, {
                      ...item,
                      followUps: {
                        ...item.followUps,
                        yes: { ...item.followUps.yes, correctiveOn: val },
                      },
                    })
                  }
                />
              </div>
            </div>

            {/* On NO */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 13, color: "#111", minWidth: 80 }}>On No:</label>
              <input
                type="text"
                value={item.followUps.no.text}
                onChange={(e) =>
                  onUpdate(index, {
                    ...item,
                    followUps: {
                      ...item.followUps,
                      no: { ...item.followUps.no, text: e.target.value },
                    },
                  })
                }
                placeholder="Follow-up question to ask when answer is No"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  id={`no-enabled-${index}`}
                  type="checkbox"
                  checked={item.followUps.no.enabled}
                  onChange={(e) =>
                    onUpdate(index, {
                      ...item,
                      followUps: {
                        ...item.followUps,
                        no: { ...item.followUps.no, enabled: e.target.checked },
                      },
                    })
                  }
                />
                <label htmlFor={`no-enabled-${index}`} style={{ fontSize: 12 }}>
                  Enable
                </label>
              </div>
              <div />
              <div style={{ gridColumn: "2 / span 2" }}>
                <CorrectiveRuleSelect
                  value={item.followUps.no.correctiveOn}
                  onChange={(val) =>
                    onUpdate(index, {
                      ...item,
                      followUps: {
                        ...item.followUps,
                        no: { ...item.followUps.no, correctiveOn: val },
                      },
                    })
                  }
                />
              </div>
            </div>
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
            style={{ fontSize: "28px", color: "#111", fontWeight: 700, margin: 0 }}
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
                setDraftId(null);
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
          {/* Drafts */}
          {drafts.length > 0 && (
            <>
              <SectionTitle>Your Drafts</SectionTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 14,
                }}
              >
                {drafts.map((d) => (
                  <Card key={d.id}>
                    <div style={{ paddingRight: 104 }}>
                      <div style={{ fontWeight: 700, color: "#111", marginBottom: 6 }}>
                        {d.title || "Checklist draft"}
                        <span style={{ ...tinyDraftChip, marginLeft: 8 }}>Draft</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>
                        Updated: {formatTimestamp(d.updatedAt)}
                      </div>
                    </div>
                    <Button
                      kind="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        resumeDraft(d);
                      }}
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 90,
                        padding: "6px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Resume
                    </Button>
                    <Button
                      kind="danger"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm("Delete this draft?")) return;
                        try {
                          await deleteDoc(doc(db, "checklistDrafts", d.id));
                          const updated = drafts.filter((x) => x.id !== d.id);
                          setDrafts(updated);
                          const m = {};
                          updated.forEach((x) => (m[x.checklistId] = x));
                          setDraftMap(m);
                        } catch (err) {
                          console.error("Error deleting draft:", err);
                        }
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
                  </Card>
                ))}
              </div>
            </>
          )}

          <SectionTitle style={{ marginTop: drafts.length ? 24 : 0 }}>
            Your Checklists
          </SectionTitle>

          {siteChecklists.length === 0 && (
            <Card hoverable={false} style={{ textAlign: "center" }}>
              <div style={{ color: "#6b7280" }}>No checklists yet for this site.</div>
              {isManager && (
                <Button kind="primary" onClick={() => setAdding(true)} style={{ marginTop: 12 }}>
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
            {siteChecklists.map((cl) => {
              const hasDraft = !!draftMap[cl.id];
              return (
                <Card key={cl.id} onClick={() => openChecklist(cl)}>
                  <div style={{ paddingRight: 140 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#111",
                        marginBottom: 6,
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {cl.title}
                      <span style={freqChip(cl.frequency)}>{cl.frequency || "Ad hoc"}</span>
                      {hasDraft && <span style={tinyDraftChip}>Draft</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      {Array.isArray(cl.questions) ? cl.questions.length : 0} question
                      {Array.isArray(cl.questions) && cl.questions.length !== 1 ? "s" : ""}
                    </div>
                    {hasDraft && (
                      <div style={{ fontSize: 12, color: "#9a3412", marginTop: 6 }}>
                        Last draft update: {formatTimestamp(draftMap[cl.id]?.updatedAt)}
                      </div>
                    )}
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
                          right: 96,
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
              );
            })}
          </div>

          {siteCompleted.length > 0 && (
            <>
              <SectionTitle style={{ marginTop: 24 }}>Completed Checklists</SectionTitle>
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
                        {c.frequency && <span style={freqChip(c.frequency)}>{c.frequency}</span>}
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
            <Button kind="primary" onClick={() => checklistTitle.trim() !== "" && setTitleSet(true)}>
              Start Adding Questions
            </Button>
            <Button onClick={resetView}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* ADD CHECKLIST — QUESTIONS STEP */}
      {adding && titleSet && !editingId && (
        <Card hoverable={false}>
          <SectionTitle>
            {checklistTitle}
            <span style={freqChip(newFrequency)}>{newFrequency}</span>
          </SectionTitle>
          <div style={{ color: "#6b7280", marginBottom: 10 }}>
            Add your questions, set corrective rules, and optional follow-ups.
          </div>

          {renderAuthoringItems(items, updateItemAuthor, removeItemAuthor)}

          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
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

      {/* EDIT CHECKLIST */}
      {editingId && !adding && !selectedChecklist && !viewingCompleted && (
        <Card hoverable={false}>
          <SectionTitle>Edit Checklist</SectionTitle>
          <div style={{ color: "#6b7280", marginBottom: 10 }}>
            Update the title, frequency, questions, corrective rules, and follow-ups.
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

          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
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
            <span style={freqChip(selectedChecklist.frequency)}>
              {selectedChecklist.frequency || "Ad hoc"}
            </span>
          </SectionTitle>
          {renderChecklistItemsRun(true)}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <Button kind="success" onClick={saveAnswers}>
              Submit Answers
            </Button>
            <Button kind="warn" onClick={saveDraft}>
              Save Draft
            </Button>
            {draftId && (
              <Button kind="danger" onClick={discardDraft}>
                Discard Draft
              </Button>
            )}
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