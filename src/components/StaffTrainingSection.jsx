// src/components/StaffTrainingSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

// ===== Shared inline styles (to match your app) =====
const wrap = {
  maxWidth: "980px",
  margin: "0 auto",
  padding: "40px 20px",
  fontFamily: "'Inter', sans-serif",
  color: "#111",
};
const title = { fontSize: "28px", fontWeight: 700, marginBottom: "22px", textAlign: "center" };
const card = { background: "#fff", borderRadius: "14px", padding: "18px", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", marginBottom: "18px" };
const row = { display: "flex", gap: 10, flexWrap: "wrap" };
const input = { padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: 14, outline: "none", minWidth: 160, background: "#fff" };
const area = { ...input, width: "100%", minHeight: 72, resize: "vertical" };
const button = (bg = "#f3f4f6", fg = "#111") => ({ padding: "10px 14px", borderRadius: "10px", border: "none", cursor: "pointer", backgroundColor: bg, color: fg, fontWeight: 600, transition: "all .2s" });
const primaryBtn = button("#22c55e", "#fff");
const blueBtn = button("#2563eb", "#fff");
const redBtn = button("#ef4444", "#fff");
const grayBtn = button();
const chip = (bg, fg) => ({ display: "inline-block", padding: "4px 10px", borderRadius: "999px", fontSize: 12, fontWeight: 700, background: bg, color: fg });

// ===== Common training course options =====
const COURSE_OPTIONS = [
  "Food Hygiene Level 2",
  "Allergen Awareness",
  "HACCP Induction",
  "Probe Use & Calibration",
  "COSHH Awareness",
  "First Aid (Emergency)",
  "Fire Safety",
  "Manual Handling",
];

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

function diffDays(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const a = new Date(fromIso);
  const b = new Date(toIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// Status helper: Valid / Expiring soon (<=30 days) / Expired / No expiry
function trainingStatus(completedOn, expiresOn) {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!expiresOn) return { label: "No expiry", style: chip("#e5e7eb", "#111") };
  const daysLeft = diffDays(todayIso, expiresOn);
  if (daysLeft === null) return { label: "No expiry", style: chip("#e5e7eb", "#111") };
  if (daysLeft < 0) return { label: "Expired", style: chip("#fee2e2", "#991b1b") };
  if (daysLeft <= 30) return { label: `Expiring in ${daysLeft}d`, style: chip("#fef3c7", "#92400e") };
  return { label: "Valid", style: chip("#dcfce7", "#065f46") };
}

const StaffTrainingSection = ({ site, user, goBack }) => {
  // Staff
  useEffect(() => {
  if (!site) return;

  // 1) Global staff directory
  const unsubProfiles = onSnapshot(
    collection(db, "staffProfiles"),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) =>
        (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
      );
      setStaffProfiles(list);
    },
    (err) => console.error("staffProfiles listener error:", err)
  );

  // 2) Site staff links (template-link equivalent)
  const unsubSiteStaff = onSnapshot(
    query(collection(db, "siteStaff"), where("site", "==", site)),
    (snap) => {
      const links = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSiteStaffLinks(links);
    },
    (err) => console.error("siteStaff listener error:", err)
  );

  return () => {
    unsubProfiles();
    unsubSiteStaff();
  };
}, [site]);
  const [newStaff, setNewStaff] = useState({ name: "", role: "", contact: "" });
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [staffEdit, setStaffEdit] = useState(null);

  // Training records
  const [training, setTraining] = useState([]);
  const [newTraining, setNewTraining] = useState({
    staffId: "",
    course: "",
    provider: "",
    completedOn: "",
    expiresOn: "",
    certificateUrl: "",
    notes: "",
  });
  const [editingTrainingId, setEditingTrainingId] = useState(null);
  const [trainingEdit, setTrainingEdit] = useState(null);

  // Filters
  const [filterStaffId, setFilterStaffId] = useState("");
  const [searchCourse, setSearchCourse] = useState("");

  // ===== Firestore listeners =====
// Staff (GLOBAL + site links)
const [staffProfiles, setStaffProfiles] = useState([]); // global staff directory
const [siteStaffLinks, setSiteStaffLinks] = useState([]); // who is assigned to this site

  useEffect(() => {
    if (!site) return;
    const qTrain = query(collection(db, "trainingRecords"), where("site", "==", site));
    const unsub = onSnapshot(
      qTrain,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // sort by completedOn desc (string yyyy-mm-dd works lexicographically)
        list.sort((a, b) => (b.completedOn || "").localeCompare(a.completedOn || ""));
        setTraining(list);
      },
      (err) => console.error("training listener error:", err)
    );
    return () => unsub();
  }, [site]);

  const staffProfileMap = useMemo(
  () => Object.fromEntries(staffProfiles.map((p) => [p.id, p])),
  [staffProfiles]
);

const siteStaffIdSet = useMemo(() => {
  const enabled = siteStaffLinks.filter((l) => l.enabled !== false);
  return new Set(enabled.map((l) => l.staffId));
}, [siteStaffLinks]);

// Effective staff list for THIS site (what your UI will show)
const staff = useMemo(() => {
  const enabledLinks = siteStaffLinks.filter((l) => l.enabled !== false);

  const joined = enabledLinks
    .map((l) => {
      const p = staffProfileMap[l.staffId];
      if (!p) return null;
      return {
        ...p,
        _siteStaffLinkId: l.id,
        role: l.roleOverride?.trim() ? l.roleOverride.trim() : p.role,
      };
    })
    .filter(Boolean);

  joined.sort((a, b) =>
    (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
  );

  return joined;
}, [siteStaffLinks, staffProfileMap]);

// Map for quick lookup
const staffMap = useMemo(
  () => Object.fromEntries(staff.map((s) => [s.id, s])),
  [staff]
);

  // ===== Staff CRUD =====
  const saveNewStaff = async () => {
    const name = (newStaff.name || "").trim();
    if (!name) return;
    await addDoc(collection(db, "staff"), {
      name,
      role: (newStaff.role || "").trim(),
      contact: (newStaff.contact || "").trim(),
      site,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });
    setNewStaff({ name: "", role: "", contact: "" });
  };

  const startEditStaff = (s) => {
    setEditingStaffId(s.id);
    setStaffEdit({ name: s.name || "", role: s.role || "", contact: s.contact || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEditStaff = async () => {
    if (!staffEdit?.name?.trim()) return;
    await updateDoc(doc(db, "staff", editingStaffId), {
      name: staffEdit.name.trim(),
      role: (staffEdit.role || "").trim(),
      contact: (staffEdit.contact || "").trim(),
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    });
    setEditingStaffId(null);
    setStaffEdit(null);
  };

  const delStaff = async (id) => {
    if (!window.confirm("Delete this staff member? Their training records remain until removed separately.")) return;
    await deleteDoc(doc(db, "staff", id));
  };

  // ===== Training CRUD =====
  const saveNewTraining = async () => {
    if (!newTraining.staffId || !(newTraining.course || "").trim()) return;
    await addDoc(collection(db, "trainingRecords"), {
      staffId: newTraining.staffId,
      course: newTraining.course.trim(),
      provider: (newTraining.provider || "").trim(),
      completedOn: newTraining.completedOn || "", // yyyy-mm-dd
      expiresOn: newTraining.expiresOn || "",
      certificateUrl: (newTraining.certificateUrl || "").trim(),
      notes: (newTraining.notes || "").trim(),
      site,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });
    setNewTraining({
      staffId: "",
      course: "",
      provider: "",
      completedOn: "",
      expiresOn: "",
      certificateUrl: "",
      notes: "",
    });
  };

  const startEditTraining = (t) => {
    setEditingTrainingId(t.id);
    setTrainingEdit({
      staffId: t.staffId || "",
      course: t.course || "",
      provider: t.provider || "",
      completedOn: t.completedOn || "",
      expiresOn: t.expiresOn || "",
      certificateUrl: t.certificateUrl || "",
      notes: t.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEditTraining = async () => {
    if (!trainingEdit?.staffId || !(trainingEdit.course || "").trim()) return;
    await updateDoc(doc(db, "trainingRecords", editingTrainingId), {
      staffId: trainingEdit.staffId,
      course: trainingEdit.course.trim(),
      provider: (trainingEdit.provider || "").trim(),
      completedOn: trainingEdit.completedOn || "",
      expiresOn: trainingEdit.expiresOn || "",
      certificateUrl: (trainingEdit.certificateUrl || "").trim(),
      notes: (trainingEdit.notes || "").trim(),
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    });
    setEditingTrainingId(null);
    setTrainingEdit(null);
  };

  const delTraining = async (id) => {
    if (!window.confirm("Delete this training record?")) return;
    await deleteDoc(doc(db, "trainingRecords", id));
  };

  // ===== Derived listings =====
  const filteredTraining = training.filter((t) => {
    if (filterStaffId && t.staffId !== filterStaffId) return false;
    if (searchCourse && !(t.course || "").toLowerCase().includes(searchCourse.toLowerCase())) return false;
    return true;
  });

  // Group by staff for display
  const trainingByStaff = useMemo(() => {
    const m = {};
    for (const t of filteredTraining) {
      if (!m[t.staffId]) m[t.staffId] = [];
      m[t.staffId].push(t);
    }
    return m;
  }, [filteredTraining]);

  const workingStaff = editingStaffId ? staffEdit : newStaff;
  const workingTraining = editingTrainingId ? trainingEdit : newTraining;

  return (
    <div style={wrap}>
      <h2 style={title}>
        Staff Training — <span style={{ color: "#2563eb" }}>{site}</span>
      </h2>

      {/* Add/Edit Staff */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
          {editingStaffId ? "Edit Staff Member" : "Add Staff Member"}
        </div>
        <div style={row}>
          <input
            style={{ ...input, minWidth: 220, flex: 1 }}
            placeholder="Full name"
            value={workingStaff.name}
            onChange={(e) => (editingStaffId ? setStaffEdit : setNewStaff)((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            style={{ ...input, minWidth: 180 }}
            placeholder="Role (e.g., Server, Chef)"
            value={workingStaff.role}
            onChange={(e) => (editingStaffId ? setStaffEdit : setNewStaff)((p) => ({ ...p, role: e.target.value }))}
          />
          <input
            style={{ ...input, minWidth: 220, flex: 1 }}
            placeholder="Contact (email or phone)"
            value={workingStaff.contact}
            onChange={(e) => (editingStaffId ? setStaffEdit : setNewStaff)((p) => ({ ...p, contact: e.target.value }))}
          />
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {editingStaffId ? (
            <>
              <button onClick={saveEditStaff} style={blueBtn}>Save Changes</button>
              <button onClick={() => { setEditingStaffId(null); setStaffEdit(null); }} style={grayBtn}>Cancel</button>
            </>
          ) : (
            <button onClick={saveNewStaff} style={primaryBtn}>Add Staff</button>
          )}
        </div>
      </div>

      {/* Add/Edit Training */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
          {editingTrainingId ? "Edit Training Record" : "Add Training Record"}
        </div>
        <div style={row}>
          <select
            style={{ ...input, minWidth: 220 }}
            value={workingTraining.staffId}
            onChange={(e) => (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({ ...p, staffId: e.target.value }))}
          >
            <option value="">Select staff member…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <input
            list="courseOptions"
            style={{ ...input, minWidth: 220, flex: 1 }}
            placeholder="Course (e.g., Food Hygiene Level 2)"
            value={workingTraining.course}
            onChange={(e) => (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({ ...p, course: e.target.value }))}
          />
          <datalist id="courseOptions">
            {COURSE_OPTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>

          <input
            style={{ ...input, minWidth: 180 }}
            placeholder="Provider (e.g., FSA, Highfield)"
            value={workingTraining.provider}
            onChange={(e) => (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({ ...p, provider: e.target.value }))}
          />

          <input
            type="date"
            style={{ ...input, minWidth: 160 }}
            value={workingTraining.completedOn}
            onChange={(e) => (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({ ...p, completedOn: e.target.value }))}
          />
          <input
            type="date"
            style={{ ...input, minWidth: 160 }}
            value={workingTraining.expiresOn}
            onChange={(e) => (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({ ...p, expiresOn: e.target.value }))}
          />
        </div>

        <div style={{ ...row, marginTop: 8 }}>
          <input
            style={{ ...input, minWidth: 320, flex: 1 }}
            placeholder="Certificate URL (optional)"
            value={workingTraining.certificateUrl}
            onChange={(e) => (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({ ...p, certificateUrl: e.target.value }))}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <textarea
            style={area}
            placeholder="Notes (e.g., refresher due, observations)"
            value={workingTraining.notes}
            onChange={(e) => (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {editingTrainingId ? (
            <>
              <button onClick={saveEditTraining} style={blueBtn}>Save Changes</button>
              <button onClick={() => { setEditingTrainingId(null); setTrainingEdit(null); }} style={grayBtn}>Cancel</button>
            </>
          ) : (
            <button onClick={saveNewTraining} style={primaryBtn}>Add Training</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Filters</div>
        <div style={row}>
          <select
            style={{ ...input, minWidth: 220 }}
            value={filterStaffId}
            onChange={(e) => setFilterStaffId(e.target.value)}
          >
            <option value="">All staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            style={{ ...input, minWidth: 220 }}
            placeholder="Search by course"
            value={searchCourse}
            onChange={(e) => setSearchCourse(e.target.value)}
          />
        </div>
      </div>

      {/* Staff list with training underneath */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Training Matrix</div>
        {staff.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No staff yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {staff
              .filter((s) => !filterStaffId || s.id === filterStaffId)
              .map((s) => {
                const records = (trainingByStaff[s.id] || []).sort((a, b) =>
                  (a.course || "").localeCompare(b.course || "")
                );
                return (
                  <li key={s.id} style={{ borderBottom: "1px solid #f1f5f9", padding: "14px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{s.name} {s.role ? <span style={{ color: "#6b7280", fontWeight: 500 }}>— {s.role}</span> : null}</div>
                        {s.contact && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{s.contact}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => startEditStaff(s)} style={grayBtn}>Edit</button>
                        <button onClick={() => delStaff(s.id)} style={redBtn}>Delete</button>
                      </div>
                    </div>

                    {/* Training records table-ish list */}
                    {records.length === 0 ? (
                      <div style={{ color: "#6b7280", marginTop: 8, fontSize: 13 }}>No training on record.</div>
                    ) : (
                      <div style={{ marginTop: 10 }}>
                        {records.map((t) => {
                          const st = trainingStatus(t.completedOn, t.expiresOn);
                          return (
                            <div key={t.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, marginBottom: 8, display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 8, alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{t.course || "—"}</div>
                                <div style={{ fontSize: 12, color: "#6b7280" }}>{t.provider || "Provider —"}</div>
                                {t.notes && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{t.notes}</div>}
                                {t.certificateUrl && (
                                  <div style={{ fontSize: 12, marginTop: 4 }}>
                                    <a href={t.certificateUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
                                      Certificate
                                    </a>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div style={{ fontSize: 12, color: "#6b7280" }}>Completed</div>
                                <div style={{ fontWeight: 600 }}>{formatDate(t.completedOn)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, color: "#6b7280" }}>Expires</div>
                                <div style={{ fontWeight: 600 }}>{formatDate(t.expiresOn)}</div>
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
                                <span style={st.style}>{st.label}</span>
                                <button onClick={() => startEditTraining(t)} style={grayBtn}>Edit</button>
                                <button onClick={() => delTraining(t.id)} style={redBtn}>Delete</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <button
          onClick={goBack}
          style={grayBtn}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default StaffTrainingSection;