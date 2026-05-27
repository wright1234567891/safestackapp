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

const makeId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `q_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
};

// Stable local IDs for objects that don't yet have an id (prevents input remount / focus loss)
const __localIdMap = new WeakMap();

const getStableId = (q) => {
  if (q?.id) return q.id;
  if (!q || typeof q !== "object") return makeId();

  const existing = __localIdMap.get(q);
  if (existing) return existing;

  const id = makeId();
  __localIdMap.set(q, id);
  return id;
};

const freqChip = (f) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: 12,
    fontWeight: 800,
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
      return { ...base, background: "#f1f5f9", color: "#334155" };
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
  display: "inline-flex",
  alignItems: "center",
};

const inputStyle = {
  padding: "12px 14px",
  fontSize: 15,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  outline: "none",
  background: "#fff",
  color: "#0f172a",
  boxSizing: "border-box",
};

const mutedText = {
  color: "#64748b",
  fontSize: 13,
};

// NEW: Utilities for new schema with sensible defaults (backward-compatible)
const withQuestionDefaults = (q) => {
  return {
    id: getStableId(q),
    text: q?.text ?? "",
    enabled: q?.enabled ?? true,
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
      return false;
  }
};

// ---------- Component ----------
const ChecklistSection = ({ goBack, site, user, onOpeningComplete }) => {
  const [checklists, setChecklists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [siteTemplates, setSiteTemplates] = useState([]);
  const [viewingTemplates, setViewingTemplates] = useState(false);
  const [completed, setCompleted] = useState([]);

  // DRAFTS
  const [drafts, setDrafts] = useState([]);
  const [draftMap, setDraftMap] = useState({});

  // Authoring state (Create)
  const [adding, setAdding] = useState(false);
  const [createTarget, setCreateTarget] = useState("checklists");
  const [titleSet, setTitleSet] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState("");
  const [newFrequency, setNewFrequency] = useState("Daily");
  const [authorQuestions, setAuthorQuestions] = useState([]);

  // Running / Viewing
  const [runQuestions, setRunQuestions] = useState([]);
  const [viewQuestions, setViewQuestions] = useState([]);
  const [newItem, setNewItem] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editingSiteTemplate, setEditingSiteTemplate] = useState(null);
  const [editingSource, setEditingSource] = useState("checklists");
  const [editTitle, setEditTitle] = useState("");
  const [editFrequency, setEditFrequency] = useState("Ad hoc");
  const [editItems, setEditItems] = useState([]);
  const [editNewItem, setEditNewItem] = useState("");

  const newItemRef = useRef(null);
  const editNewItemRef = useRef(null);

  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [viewingCompleted, setViewingCompleted] = useState(null);
  const [draftId, setDraftId] = useState(null);

  const uid = user?.uid || null;

  const personName =
    typeof user === "string"
      ? user
      : user?.displayName || user?.name || user?.email || "Unknown";

  const [role, setRole] = useState(() =>
    (user?.role || "staff").toString().toLowerCase()
  );

  const isManager =
    role === "manager" ||
    role === "admin" ||
    ["chris", "chloe"].includes((user?.displayName || user?.name || "").toLowerCase()) ||
    ["christopher.wright@oaknsmkbbq.com"].includes((user?.email || "").toLowerCase());

  useEffect(() => {
    let ignore = false;

    async function loadRole() {
      if (user?.role) return;

      if (!uid) {
        if (!ignore) setRole("staff");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.exists() ? snap.data() : null;
        const r = (data?.role || "staff").toString().toLowerCase();
        if (!ignore) setRole(r);
      } catch {
        if (!ignore) setRole("staff");
      }
    }

    loadRole();
    return () => {
      ignore = true;
    };
  }, [uid, user?.role]);

  // Firestore refs
  const checklistCollectionRef = collection(db, "checklists");
  const templatesCollectionRef = collection(db, "templates");
  const siteTemplatesCollectionRef = collection(db, "siteTemplates");
  const completedCollectionRef = collection(db, "completed");
  const draftsCollectionRef = collection(db, "checklistDrafts");

  // ---------- Build effective checklists from templates ----------
  const buildChecklistsFromTemplates = (siteTemplateRows, templatesRows) => {
    const tplMap = new Map(templatesRows.map((t) => [t.id, t]));
    const enabledLinks = siteTemplateRows.filter((st) => st.enabled !== false);

    return enabledLinks
      .map((st) => {
        const tpl = tplMap.get(st.templateId);
        if (!tpl) return null;

        const overrideTitle = st.overrides?.title;
        const qOverrides = st.overrides?.questions || {};

        const questions = (tpl.questions || []).map((q) => {
          const base = withQuestionDefaults(q);
          const o = qOverrides[base.id];
          return {
            ...base,
            enabled: o?.enabled ?? base.enabled ?? true,
          };
        });

        return {
          id: tpl.id,
          site,
          title: overrideTitle || tpl.title,
          frequency: tpl.frequency || "Ad hoc",
          questions,
          _source: "template",
          _templateId: tpl.id,
        };
      })
      .filter(Boolean);
  };

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

  // ---------- Fetch ----------
  useEffect(() => {
    if (!site) return;

    const fetchData = async () => {
      try {
        const qSiteTemplates = query(
          siteTemplatesCollectionRef,
          where("site", "==", site)
        );
        const stSnap = await getDocs(qSiteTemplates);
        const siteTemplateRows = stSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSiteTemplates(siteTemplateRows);

        if (siteTemplateRows.length > 0) {
          const tplSnap = await getDocs(templatesCollectionRef);
          const templatesRows = tplSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const effective = buildChecklistsFromTemplates(siteTemplateRows, templatesRows);
          setChecklists(effective);
        } else {
          const qChecklist = query(
            checklistCollectionRef,
            where("site", "==", site),
            orderBy("createdAt", "desc")
          );
          const checklistSnapshot = await getDocs(qChecklist);
          setChecklists(
            checklistSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
          );
        }
      } catch (err) {
        console.error("Error fetching checklists/templates:", err);

        try {
          const qChecklistFallback = query(
            checklistCollectionRef,
            where("site", "==", site)
          );
          const snap = await getDocs(qChecklistFallback);
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setChecklists(rows);
        } catch (err2) {
          console.error("Error fetching checklists fallback:", err2);
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

      try {
        const tplSnap = await getDocs(templatesCollectionRef);
        setTemplates(tplSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching templates:", err);
        setTemplates([]);
      }

      await refreshDrafts();
    };

    fetchData();
    resetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

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

  // ---------- Authoring ----------
  const newQuestion = (text = "") =>
    withQuestionDefaults({
      id: makeId(),
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
    setAuthorQuestions((prev) => [...prev, newQuestion(newItem.trim())]);
    setNewItem("");
    requestAnimationFrame(() => newItemRef.current?.focus());
  };

  const updateItemAuthor = (index, updater) => {
    const updated = [...authorQuestions];
    const current = withQuestionDefaults(updated[index]);
    updated[index] = typeof updater === "function" ? updater(current) : updater;
    setAuthorQuestions(updated);
  };

  const removeItemAuthor = (index) => {
    const updated = [...authorQuestions];
    updated.splice(index, 1);
    setAuthorQuestions(updated);
  };

  const saveChecklist = async () => {
    if (!checklistTitle.trim() || authorQuestions.length === 0) {
      alert("Checklist must have a title and at least one question");
      return;
    }

    const record = {
      site,
      title: checklistTitle.trim(),
      frequency: newFrequency || "Ad hoc",
      questions: authorQuestions.map(withQuestionDefaults),
      createdAt: Timestamp.now(),
      person: personName,
    };

    try {
      const docRef = await addDoc(
        createTarget === "templates" ? templatesCollectionRef : checklistCollectionRef,
        record
      );

      if (createTarget === "templates") {
        setTemplates((prev) => [{ id: docRef.id, ...record }, ...prev]);
      } else {
        setChecklists((prev) => [{ id: docRef.id, ...record }, ...prev]);
      }

      setChecklistTitle("");
      setNewFrequency("Daily");
      setAuthorQuestions([]);
      setTitleSet(false);
      setAdding(false);
    } catch (error) {
      console.error("Error adding checklist:", error);
    }
  };

  // ---------- Editing ----------
  const startEditChecklist = (cl) => {
    setEditingId(cl.id);
    setEditingSource(cl._source === "template" ? "templates" : "checklists");
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
    if (!editingId && !editingSiteTemplate) return;

    if (editingSiteTemplate) {
      try {
        const overrides = { questions: {} };

        editItems.forEach((q) => {
          if (q.enabled === false) {
            overrides.questions[q.id] = { enabled: false };
          }
        });

        await updateDoc(
          doc(db, "siteTemplates", editingSiteTemplate._siteTemplate.id),
          { overrides }
        );

        setEditingSiteTemplate(null);
        setEditingId(null);
        return;
      } catch (err) {
        console.error("Error saving site overrides:", err);
        alert("Could not save site overrides.");
        return;
      }
    }

    if (!editTitle.trim() || editItems.length === 0) {
      alert("Checklist must have a title and at least one question");
      return;
    }

    try {
      await updateDoc(
        doc(db, editingSource === "templates" ? "templates" : "checklists", editingId),
        {
          title: editTitle.trim(),
          frequency: editFrequency || "Ad hoc",
          questions: editItems.map(withQuestionDefaults),
          updatedAt: Timestamp.now(),
          updatedBy: personName,
        }
      );

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
      console.error("Error saving checklist/template edits:", err);
      alert("Could not save changes.");
    }
  };

  const cancelEdit = () => {
    setEditingSiteTemplate(null);
    setEditingId(null);
    setEditTitle("");
    setEditFrequency("Ad hoc");
    setEditItems([]);
    setEditNewItem("");
  };

  // ---------- Site template helpers ----------
  const isTemplateEnabledForSite = (templateId) =>
    siteTemplates.some(
      (st) => st.templateId === templateId && st.enabled !== false
    );

  const addTemplateToSite = async (templateId) => {
    try {
      await addDoc(siteTemplatesCollectionRef, {
        site,
        templateId,
        enabled: true,
        createdAt: Timestamp.now(),
        createdBy: personName,
      });

      const snap = await getDocs(
        query(siteTemplatesCollectionRef, where("site", "==", site))
      );
      setSiteTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error adding template to site:", e);
    }
  };

  const removeTemplateFromSite = async (templateId) => {
    try {
      const match = siteTemplates.find((st) => st.templateId === templateId);
      if (!match) return;

      await deleteDoc(doc(db, "siteTemplates", match.id));

      setSiteTemplates((prev) =>
        prev.filter((st) => st.templateId !== templateId)
      );
    } catch (e) {
      console.error("Error removing template from site:", e);
    }
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
          setRunQuestions(data.questions.map(withQuestionDefaults));
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
      questions: runQuestions.map(withQuestionDefaults),
      frequency: selectedChecklist.frequency || "Ad hoc",
      status: "draft",
    };

    try {
      if (draftId) {
        await updateDoc(doc(db, "checklistDrafts", draftId), {
          ...base,
          updatedAt: Timestamp.now(),
        });
      } else {
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

  // ---------- Running ----------
  const openChecklist = async (cl) => {
    const freshQuestions = (cl.questions || [])
      .filter((q) => q.enabled !== false)
      .map((q) =>
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
    setRunQuestions(freshQuestions);
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
    setRunQuestions((draft.questions || []).map(withQuestionDefaults));
    setAdding(false);
    setTitleSet(false);
    setEditingId(null);
    setViewingCompleted(null);
    setDraftId(draft.id);
  };

  const handleAnswerChange = (index, value) => {
    const updated = [...runQuestions];
    const item = withQuestionDefaults(updated[index]);
    item.answer = value;

    if (value === "Yes") {
      item.followUpAnswers.no = { answer: null, corrective: "" };
    } else if (value === "No") {
      item.followUpAnswers.yes = { answer: null, corrective: "" };
    } else if (value === "N/A") {
      item.followUpAnswers.yes = { answer: null, corrective: "" };
      item.followUpAnswers.no = { answer: null, corrective: "" };
    }

    if (!needsCorrective(item.correctiveOn, value)) {
      item.corrective = "";
    }
    updated[index] = item;
    setRunQuestions(updated);
  };

  const handleCorrectiveChange = (index, value) => {
    const updated = [...runQuestions];
    const item = withQuestionDefaults(updated[index]);
    item.corrective = value;
    updated[index] = item;
    setRunQuestions(updated);
  };

  const handleFollowUpAnswer = (index, branch, value) => {
    const updated = [...runQuestions];
    const item = withQuestionDefaults(updated[index]);
    const fa = { ...(item.followUpAnswers?.[branch] ?? { answer: null, corrective: "" }) };
    fa.answer = value;
    if (!needsCorrective(item.followUps[branch].correctiveOn, value)) {
      fa.corrective = "";
    }
    item.followUpAnswers = { ...item.followUpAnswers, [branch]: fa };
    updated[index] = item;
    setRunQuestions(updated);
  };

  const handleFollowUpCorrective = (index, branch, value) => {
    const updated = [...runQuestions];
    const item = withQuestionDefaults(updated[index]);
    const fa = { ...(item.followUpAnswers?.[branch] ?? { answer: null, corrective: "" }) };
    fa.corrective = value;
    item.followUpAnswers = { ...item.followUpAnswers, [branch]: fa };
    updated[index] = item;
    setRunQuestions(updated);
  };

  const saveAnswers = async () => {
    if (!selectedChecklist) return;

    try {
      const now = Timestamp.now();

      if (!selectedChecklist._source || selectedChecklist._source !== "template") {
        try {
          await updateDoc(doc(db, "checklists", selectedChecklist.id), {
            lastCompletedAt: now,
            lastCompletedBy: personName,
          });
        } catch (e) {
          console.warn("Skipping lastCompleted stamp (checklists doc missing?):", e?.message);
        }
      }

      const completedEntry = {
        site,
        createdAt: now,
        person: personName,
        title: selectedChecklist.title,
        frequency: selectedChecklist.frequency || "Ad hoc",
        questions: runQuestions.map(withQuestionDefaults),
        source: selectedChecklist._source === "template" ? "template" : "checklist",
        templateId: selectedChecklist._source === "template" ? selectedChecklist.id : null,
        checklistId: selectedChecklist._source === "template" ? null : selectedChecklist.id,
      };

      const docRef = await addDoc(completedCollectionRef, completedEntry);
      setCompleted((prev) => [{ id: docRef.id, ...completedEntry }, ...prev]);
      const titleLower = (selectedChecklist.title || "").toLowerCase();

if (titleLower.includes("opening")) {

  onOpeningComplete?.();

}

      if (draftId) {
        await deleteDoc(doc(db, "checklistDrafts", draftId));
        setDraftId(null);
      }
      await refreshDraftsForPerson();

      setSelectedChecklist(null);
      setRunQuestions([]);
    } catch (error) {
      console.error("Error saving answers:", error);
      alert("Could not submit answers. Please try again.");
    }
  };

  const deleteChecklist = async (cl) => {
    if (!window.confirm(`Delete checklist "${cl.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "checklists", cl.id));
      setChecklists((prev) => prev.filter((c) => c.id !== cl.id));

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
    setViewQuestions(c.questions.map(withQuestionDefaults));
    setSelectedChecklist(null);
    setDraftId(null);
  };

  const resetView = () => {
    setAdding(false);
    setTitleSet(false);
    setChecklistTitle("");
    setNewFrequency("Daily");
    setAuthorQuestions([]);
    setRunQuestions([]);
    setViewQuestions([]);
    setNewItem("");
    setSelectedChecklist(null);
    setViewingCompleted(null);
    setDraftId(null);
    setEditingId(null);
    setEditTitle("");
    setEditFrequency("Ad hoc");
    setEditItems([]);
    setEditNewItem("");
  };

  // ---------- Export ----------
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
    subTitleEl.innerText = `Completed by: ${completedBy} — ${formatTimestamp(ts)}`;
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
      subTitle.innerText = `${cIdx + 1}. ${c.title} (Completed by ${c.person} at ${formatTimestamp(c.createdAt)})`;
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
      neutral: { bg: "#fff", hover: "#f8fafc", color: "#0f172a", border: "#e5e7eb" },
      primary: { bg: "#15803d", hover: "#166534", color: "#fff", border: "#15803d" },
      success: { bg: "#15803d", hover: "#166534", color: "#fff", border: "#15803d" },
      warn: { bg: "#f59e0b", hover: "#d97706", color: "#fff", border: "#f59e0b" },
      danger: { bg: "#dc2626", hover: "#b91c1c", color: "#fff", border: "#dc2626" },
      subtle: { bg: "#f8fafc", hover: "#f1f5f9", color: "#0f172a", border: "#e5e7eb" },
    };

    const p = palette[kind] || palette.neutral;

    return (
      <button
        type={type}
        onClick={onClick}
        style={{
          border: `1px solid ${p.border}`,
          background: p.bg,
          color: p.color,
          borderRadius: 999,
          padding: "9px 14px",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          transition: "all 0.18s ease",
          boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          ...style,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = p.hover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = p.bg)}
        tabIndex={tabIndex}
      >
        {children}
      </button>
    );
  };

  const Card = ({ children, onClick, hoverable = true, style = {} }) => (
    <div
      onClick={onClick}
      className={hoverable ? "checklist-card hoverable" : "checklist-card"}
      style={style}
    >
      {children}
    </div>
  );

  const SectionTitle = ({ children, style = {} }) => (
    <h2
      style={{
        fontSize: 18,
        color: "#0f172a",
        fontWeight: 800,
        margin: "18px 0 12px",
        letterSpacing: -0.2,
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
        ...inputStyle,
        padding: "9px 12px",
        fontSize: 13,
        minWidth: 170,
      }}
    >
      <option value="none">Corrective: None</option>
      <option value="yes">Corrective: On Yes</option>
      <option value="no">Corrective: On No</option>
      <option value="both">Corrective: Yes or No</option>
    </select>
  );

  const AnswerButtons = ({ active, onPick }) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button
        kind={active === "Yes" ? "success" : "subtle"}
        onClick={() => onPick("Yes")}
        style={{ border: active === "Yes" ? "1px solid #15803d" : "1px solid #e5e7eb" }}
      >
        Yes
      </Button>
      <Button
        kind={active === "No" ? "danger" : "subtle"}
        onClick={() => onPick("No")}
        style={{ border: active === "No" ? "1px solid #dc2626" : "1px solid #e5e7eb" }}
      >
        No
      </Button>
      <Button
        kind={active === "N/A" ? "neutral" : "subtle"}
        onClick={() => onPick("N/A")}
        style={{ border: active === "N/A" ? "1px solid #94a3b8" : "1px solid #e5e7eb" }}
      >
        N/A
      </Button>
    </div>
  );

  const isSiteOverrideMode = !!editingSiteTemplate;

  // ---------- Render helpers ----------
  const renderFollowUpRun = (item, index, branch, editable) => {
    const cfg = item.followUps?.[branch];
    if (!cfg?.enabled || !cfg?.text) return null;

    const ans = item.followUpAnswers?.[branch]?.answer ?? null;
    const correctiveVal = item.followUpAnswers?.[branch]?.corrective ?? "";

    return (
      <div style={{ marginTop: 12, paddingLeft: 14, borderLeft: "3px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, color: "#0f172a", minWidth: 240 }}>↳ {cfg.text}</div>
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
              ...inputStyle,
              marginTop: 10,
              width: "100%",
            }}
          />
        )}
      </div>
    );
  };

  const renderChecklistItemsRun = (editable = true) =>
    runQuestions.map((item, index) => {
      const ans = item.answer;
      return (
        <Card key={item.id || index} hoverable={false} style={{ margin: "12px 0" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, color: "#0f172a", fontWeight: 700, minWidth: 240 }}>{item.text}</div>
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
                ...inputStyle,
                marginTop: 12,
                width: "100%",
              }}
            />
          )}

          {ans === "Yes" && renderFollowUpRun(item, index, "yes", editable)}
          {ans === "No" && renderFollowUpRun(item, index, "no", editable)}
        </Card>
      );
    });

  const renderAuthoringItems = (list, onUpdate, onRemove) =>
    list.map((item, index) => {
      return (
        <Card key={item.id || index} hoverable={false} style={{ margin: "12px 0" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              value={item.text}
              disabled={isSiteOverrideMode}
              onChange={(e) => onUpdate(index, { ...item, text: e.target.value })}
              placeholder={`Question ${index + 1}`}
              style={{
                ...inputStyle,
                flex: 1,
                minWidth: 240,
                background: isSiteOverrideMode ? "#f8fafc" : "#fff",
              }}
            />
            <CorrectiveRuleSelect
              value={item.correctiveOn}
              onChange={(val) => onUpdate(index, { ...item, correctiveOn: val })}
            />
            <Button kind="danger" onClick={() => onRemove(index)} style={{ padding: "9px 12px" }}>
              Remove
            </Button>

            {isSiteOverrideMode && (
              <label style={{ fontSize: 13, color: "#334155", fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={item.enabled !== false}
                  onChange={(e) =>
                    onUpdate(index, {
                      ...item,
                      enabled: e.target.checked,
                    })
                  }
                />{" "}
                Enabled for this site
              </label>
            )}
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
            }}
          >
            <div style={{ fontSize: 13, color: "#334155", fontWeight: 800, marginBottom: 10 }}>
              Follow-up optional
            </div>

            <div className="followup-grid" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 13, color: "#0f172a", minWidth: 80, fontWeight: 700 }}>On Yes:</label>
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
                style={inputStyle}
              />
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#334155", fontWeight: 700 }}>
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
                Enable
              </label>
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

            <div className="followup-grid" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 13, color: "#0f172a", minWidth: 80, fontWeight: 700 }}>On No:</label>
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
                style={inputStyle}
              />
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#334155", fontWeight: 700 }}>
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
                Enable
              </label>
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
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', system-ui, -apple-system, Arial" }}>
      <style>{`
        .checklist-shell {
          max-width: 1120px;
          margin: 0 auto;
          padding: 28px;
        }

        .checklist-card {
          background: rgba(255,255,255,0.97);
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 4px 14px rgba(15,23,42,0.06);
          transition: all 0.18s ease;
          text-align: left;
          position: relative;
        }

        .checklist-card.hoverable:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15,23,42,0.08);
          background: #fff;
        }

        .checklist-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .toolbar-wrap {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
        }

        @media (max-width: 820px) {
          .checklist-shell {
            padding: 16px;
          }

          .checklist-header {
            align-items: flex-start !important;
          }

          .toolbar-wrap {
            justify-content: flex-start;
            width: 100%;
          }

          .followup-grid {
            grid-template-columns: 1fr !important;
          }

          .followup-grid > div,
          .followup-grid > label,
          .followup-grid input {
            grid-column: auto !important;
          }
        }
      `}</style>

      <div className="checklist-shell">
        {/* Header / Toolbar */}
        <div
          className="checklist-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            justifyContent: "space-between",
            marginBottom: 22,
            flexWrap: "wrap",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <h1
              style={{
                fontSize: 34,
                color: "#0f172a",
                fontWeight: 800,
                margin: 0,
                letterSpacing: -0.7,
              }}
            >
              Checklists
            </h1>
            <div style={{ ...mutedText, marginTop: 5 }}>
              {site} · Create, complete, edit and export venue checklists
            </div>
          </div>

          <div className="toolbar-wrap">
            <Button onClick={goBack}>Back</Button>
            {isManager && (
              <Button
                kind={viewingTemplates ? "primary" : "subtle"}
                onClick={() => {
                  resetView();
                  setViewingTemplates((v) => !v);
                }}
              >
                Templates
              </Button>
            )}
            {isManager && !editingId && (
              <Button
                kind="primary"
                onClick={() => {
                  setCreateTarget(viewingTemplates ? "templates" : "checklists");
                  setAdding(true);
                  setSelectedChecklist(null);
                  setViewingCompleted(null);
                  setEditingId(null);
                  setDraftId(null);
                }}
              >
                {viewingTemplates ? "+ Add Template" : "+ Add Checklist"}
              </Button>
            )}
            {siteCompleted.length > 0 && (
              <Button kind="warn" onClick={exportAllCompletedToPDF}>
                Export All Completed
              </Button>
            )}
          </div>
        </div>

        {/* TEMPLATES VIEW */}
        {viewingTemplates && !adding && !editingId && !selectedChecklist && !viewingCompleted && (
          <>
            <SectionTitle>Templates</SectionTitle>

            {templates.length === 0 && (
              <Card hoverable={false}>
                <div style={mutedText}>No templates yet.</div>
              </Card>
            )}

            <div className="checklist-grid">
              {templates.map((tpl) => (
                <Card key={tpl.id}>
                  <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                    {tpl.title}
                    <span style={freqChip(tpl.frequency)}>{tpl.frequency || "Ad hoc"}</span>
                  </div>

                  <div style={mutedText}>
                    {Array.isArray(tpl.questions) ? tpl.questions.length : 0} question
                    {Array.isArray(tpl.questions) && tpl.questions.length !== 1 ? "s" : ""}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <Button
                      kind="subtle"
                      onClick={() => {
                        startEditChecklist({ ...tpl, _source: "template" });
                        setViewingTemplates(false);
                      }}
                    >
                      Edit Template
                    </Button>

                    {isTemplateEnabledForSite(tpl.id) && (
                      <Button
                        kind="neutral"
                        onClick={() => {
                          const st = siteTemplates.find((x) => x.templateId === tpl.id);
                          if (!st) return;
                          setEditingSiteTemplate({ ...tpl, _siteTemplate: st });
                          setViewingTemplates(false);
                        }}
                      >
                        Configure for site
                      </Button>
                    )}

                    {isTemplateEnabledForSite(tpl.id) ? (
                      <Button kind="warn" onClick={() => removeTemplateFromSite(tpl.id)}>
                        Remove from site
                      </Button>
                    ) : (
                      <Button kind="success" onClick={() => addTemplateToSite(tpl.id)}>
                        Add to site
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {!viewingTemplates && !adding && !selectedChecklist && !viewingCompleted && !editingId && (
          <>
            {/* Drafts */}
            {drafts.length > 0 && (
              <>
                <SectionTitle>Your Drafts</SectionTitle>
                <div className="checklist-grid">
                  {drafts.map((d) => (
                    <Card key={d.id}>
                      <div style={{ paddingRight: 0 }}>
                        <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                          {d.title || "Checklist draft"}
                          <span style={{ ...tinyDraftChip, marginLeft: 8 }}>Draft</span>
                        </div>
                        <div style={mutedText}>Updated: {formatTimestamp(d.updatedAt)}</div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                        <Button
                          kind="subtle"
                          onClick={(e) => {
                            e.stopPropagation();
                            resumeDraft(d);
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
                        >
                          Delete
                        </Button>
                      </div>
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
                <div style={mutedText}>No checklists yet for this site.</div>
                {isManager && (
                  <Button kind="primary" onClick={() => setAdding(true)} style={{ marginTop: 12 }}>
                    Create your first checklist
                  </Button>
                )}
              </Card>
            )}

            <div className="checklist-grid">
              {siteChecklists.map((cl) => {
                const hasDraft = !!draftMap[cl.id];
                return (
                  <Card key={cl.id} onClick={() => openChecklist(cl)}>
                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "#0f172a",
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
                      <div style={mutedText}>
                        {Array.isArray(cl.questions) ? cl.questions.filter((q) => q.enabled !== false).length : 0} question
                        {Array.isArray(cl.questions) && cl.questions.filter((q) => q.enabled !== false).length !== 1 ? "s" : ""}
                      </div>
                      {hasDraft && (
                        <div style={{ fontSize: 12, color: "#9a3412", marginTop: 6 }}>
                          Last draft update: {formatTimestamp(draftMap[cl.id]?.updatedAt)}
                        </div>
                      )}
                    </div>

                    {isManager && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                        <Button
                          kind="subtle"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditChecklist(cl);
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
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {siteCompleted.length > 0 && (
              <>
                <SectionTitle style={{ marginTop: 24 }}>Completed Checklists</SectionTitle>
                <div className="checklist-grid">
                  {siteCompleted.map((c) => (
                    <Card key={c.id} onClick={() => viewCompleted(c)}>
                      <div>
                        <div
                          style={{
                            fontWeight: 800,
                            color: "#0f172a",
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
                        <div style={mutedText}>
                          By {c.person} · {formatTimestamp(c.createdAt)}
                        </div>
                      </div>

                      {isManager && (
                        <div style={{ marginTop: 12 }}>
                          <Button
                            kind="danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCompleted(c);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
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
            <SectionTitle>{createTarget === "templates" ? "New Template" : "New Checklist"}</SectionTitle>
            <div style={{ ...mutedText, marginBottom: 12 }}>
              Give it a clear, descriptive title and frequency.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                type="text"
                value={checklistTitle}
                onChange={(e) => setChecklistTitle(e.target.value)}
                placeholder="e.g. Opening Checks"
                style={{ ...inputStyle, flex: 2, minWidth: 260 }}
              />
              <select
                value={newFrequency}
                onChange={(e) => setNewFrequency(e.target.value)}
                style={{ ...inputStyle, flex: 1, minWidth: 180 }}
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
                <option>Ad hoc</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
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
            <div style={{ ...mutedText, marginBottom: 12 }}>
              Add your questions, set corrective rules and optional follow-ups.
            </div>

            {renderAuthoringItems(authorQuestions, updateItemAuthor, removeItemAuthor)}

            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
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
                style={{ ...inputStyle, flex: 1, minWidth: 240 }}
              />
              <Button kind="subtle" onClick={addItemAuthor}>
                + Add Question
              </Button>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <Button kind="success" onClick={saveChecklist}>
                Save {createTarget === "templates" ? "Template" : "Checklist"}
              </Button>
              <Button onClick={resetView}>Cancel</Button>
            </div>
          </Card>
        )}

        {/* EDIT CHECKLIST / SITE OVERRIDES */}
        {(editingId || editingSiteTemplate) && !adding && !selectedChecklist && !viewingCompleted && (
          <Card hoverable={false}>
            <SectionTitle>{isSiteOverrideMode ? "Configure Checklist for Site" : "Edit Checklist"}</SectionTitle>
            <div style={{ ...mutedText, marginBottom: 12 }}>
              {isSiteOverrideMode
                ? "Choose which template questions are enabled for this site."
                : "Update the title, frequency, questions, corrective rules and follow-ups."}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <input
                type="text"
                value={editTitle}
                disabled={isSiteOverrideMode}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Checklist title"
                style={{
                  ...inputStyle,
                  flex: 2,
                  minWidth: 260,
                  background: isSiteOverrideMode ? "#f8fafc" : "#fff",
                }}
              />
              <select
                value={editFrequency}
                disabled={isSiteOverrideMode}
                onChange={(e) => setEditFrequency(e.target.value)}
                style={{
                  ...inputStyle,
                  flex: 1,
                  minWidth: 180,
                  background: isSiteOverrideMode ? "#f8fafc" : "#fff",
                }}
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
                <option>Ad hoc</option>
              </select>
            </div>

            {renderAuthoringItems(editItems, updateEditItem, removeEditItem)}

            {!isSiteOverrideMode && (
              <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
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
                  style={{ ...inputStyle, flex: 1, minWidth: 240 }}
                />
                <Button kind="subtle" onClick={addEditItem}>
                  + Add Question
                </Button>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
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
              <span style={{ color: "#64748b", fontWeight: 600, marginLeft: 8 }}>
                Completed by {viewingCompleted.person}
              </span>
            </SectionTitle>

            {viewQuestions.map((itemRaw, index) => {
              const item = withQuestionDefaults(itemRaw);
              const ans = item.answer;
              return (
                <Card key={item.id || index} hoverable={false} style={{ margin: "12px 0" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, color: "#0f172a", fontWeight: 700, minWidth: 240 }}>{item.text}</div>
                    <AnswerButtons active={ans} onPick={() => {}} />
                  </div>

                  {needsCorrective(item.correctiveOn, ans) && (
                    <input
                      type="text"
                      value={item.corrective}
                      readOnly
                      style={{
                        ...inputStyle,
                        marginTop: 12,
                        width: "100%",
                        background: "#f8fafc",
                      }}
                    />
                  )}

                  {ans === "Yes" && renderFollowUpRun(item, index, "yes", false)}
                  {ans === "No" && renderFollowUpRun(item, index, "no", false)}
                </Card>
              );
            })}

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
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
    </div>
  );
};

export default ChecklistSection;
