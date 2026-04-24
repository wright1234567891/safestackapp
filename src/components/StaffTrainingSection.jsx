// src/components/StaffTrainingSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db, storage } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

const STAFF_COLLECTION = "stafflogin";
const TRAINING_COLLECTION = "trainingRecords";

const wrap = {
  maxWidth: "980px",
  margin: "0 auto",
  padding: "40px 20px",
  fontFamily: "'Inter', sans-serif",
  color: "#111",
};

const title = {
  fontSize: "28px",
  fontWeight: 700,
  marginBottom: "22px",
  textAlign: "center",
};

const card = {
  background: "#fff",
  borderRadius: "14px",
  padding: "18px",
  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
  marginBottom: "18px",
};

const row = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const input = {
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  fontSize: 14,
  outline: "none",
  minWidth: 160,
  background: "#fff",
};

const area = {
  ...input,
  width: "100%",
  minHeight: 72,
  resize: "vertical",
};

const button = (bg = "#f3f4f6", fg = "#111") => ({
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  backgroundColor: bg,
  color: fg,
  fontWeight: 600,
});

const primaryBtn = button("#22c55e", "#fff");
const blueBtn = button("#2563eb", "#fff");
const redBtn = button("#ef4444", "#fff");
const amberBtn = button("#f59e0b", "#fff");
const grayBtn = button();

const chip = (bg, fg) => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: 12,
  fontWeight: 700,
  background: bg,
  color: fg,
});

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

const emptyTraining = {
  staffId: "",
  course: "",
  provider: "",
  completedOn: "",
  expiresOn: "",
  certificateUrl: "",
  certificateName: "",
  notes: "",
};

const emptyStaff = {
  name: "",
  role: "",
  contact: "",
};

function normalizeSite(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

function diffDays(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const a = new Date(fromIso);
  const b = new Date(toIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function trainingStatus(expiresOn) {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!expiresOn) return { label: "No expiry", style: chip("#e5e7eb", "#111") };

  const daysLeft = diffDays(todayIso, expiresOn);
  if (daysLeft === null) return { label: "No expiry", style: chip("#e5e7eb", "#111") };
  if (daysLeft < 0) return { label: "Expired", style: chip("#fee2e2", "#991b1b") };
  if (daysLeft <= 30) return { label: `Expiring in ${daysLeft}d`, style: chip("#fef3c7", "#92400e") };

  return { label: "Valid", style: chip("#dcfce7", "#065f46") };
}

function safeFileName(name) {
  return String(name || "certificate")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

const StaffTrainingSection = ({ site, user, goBack }) => {
  const [staff, setStaff] = useState([]);
  const [training, setTraining] = useState([]);

  const [newStaff, setNewStaff] = useState(emptyStaff);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [staffEdit, setStaffEdit] = useState(null);

  const [newTraining, setNewTraining] = useState(emptyTraining);
  const [editingTrainingId, setEditingTrainingId] = useState(null);
  const [trainingEdit, setTrainingEdit] = useState(null);

  const [certificateFile, setCertificateFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [filterStaffId, setFilterStaffId] = useState("");
  const [searchCourse, setSearchCourse] = useState("");

  const siteKey = normalizeSite(site);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, STAFF_COLLECTION),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            ...data,
            contact: data.contact || data.email || "",
          };
        });

        const filtered = rows.filter((s) => {
          if (!siteKey) return s.active !== false;
          if (s.site) return normalizeSite(s.site) === siteKey && s.active !== false;
          return s.active !== false;
        });

        filtered.sort((a, b) =>
          (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
        );

        setStaff(filtered);
      },
      (err) => {
        console.error("staff listener error:", err);
        setStaff([]);
      }
    );

    return () => unsub();
  }, [siteKey]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, TRAINING_COLLECTION),
      (snap) => {
        let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list = list.filter((t) => t.deleted !== true);

        if (siteKey) {
          list = list.filter((t) => normalizeSite(t.site) === siteKey);
        }

        list.sort((a, b) => (b.completedOn || "").localeCompare(a.completedOn || ""));
        setTraining(list);
      },
      (err) => {
        console.error("training listener error:", err);
        setTraining([]);
      }
    );

    return () => unsub();
  }, [siteKey]);

  const staffMap = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s])),
    [staff]
  );

  const filteredTraining = useMemo(() => {
    return training.filter((t) => {
      if (filterStaffId && t.staffId !== filterStaffId) return false;
      if (searchCourse && !(t.course || "").toLowerCase().includes(searchCourse.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [training, filterStaffId, searchCourse]);

  const trainingByStaff = useMemo(() => {
    const m = {};
    for (const t of filteredTraining) {
      if (!m[t.staffId]) m[t.staffId] = [];
      m[t.staffId].push(t);
    }
    return m;
  }, [filteredTraining]);

  const orphanTraining = useMemo(() => {
    return filteredTraining.filter((t) => !staffMap[t.staffId]);
  }, [filteredTraining, staffMap]);

  const workingStaff = editingStaffId ? staffEdit : newStaff;
  const workingTraining = editingTrainingId ? trainingEdit : newTraining;

  const uploadCertificateIfSelected = async (staffId, course) => {
    if (!certificateFile) {
      return {
        certificateUrl: workingTraining.certificateUrl || "",
        certificateName: workingTraining.certificateName || "",
      };
    }

    const fileName = safeFileName(certificateFile.name);
    const path = `trainingCertificates/${site || "no-site"}/${staffId}/${Date.now()}_${fileName}`;
    const fileRef = ref(storage, path);

    await uploadBytes(fileRef, certificateFile);
    const url = await getDownloadURL(fileRef);

    return {
      certificateUrl: url,
      certificateName: certificateFile.name || course || "Certificate",
    };
  };

  const saveNewStaff = async () => {
    const name = (newStaff.name || "").trim();
    if (!name) return;

    await addDoc(collection(db, STAFF_COLLECTION), {
      name,
      email: (newStaff.contact || "").trim(),
      role: (newStaff.role || "").trim() || "Staff",
      site: site || "",
      active: true,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });

    setNewStaff(emptyStaff);
  };

  const startEditStaff = (s) => {
    setEditingStaffId(s.id);
    setStaffEdit({
      name: s.name || "",
      role: s.role || "",
      contact: s.contact || s.email || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEditStaff = async () => {
    if (!staffEdit?.name?.trim()) return;

    await updateDoc(doc(db, STAFF_COLLECTION, editingStaffId), {
      name: staffEdit.name.trim(),
      email: (staffEdit.contact || "").trim(),
      role: (staffEdit.role || "").trim() || "Staff",
      site: site || "",
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    });

    setEditingStaffId(null);
    setStaffEdit(null);
  };

  const deactivateStaff = async (id) => {
    if (!window.confirm("Deactivate this staff member?")) return;

    await updateDoc(doc(db, STAFF_COLLECTION, id), {
      active: false,
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    });
  };

  const activateStaff = async (id) => {
    await updateDoc(doc(db, STAFF_COLLECTION, id), {
      active: true,
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    });
  };

  const saveNewTraining = async () => {
    if (!newTraining.staffId || !(newTraining.course || "").trim()) return;

    setUploading(true);

    try {
      const cert = await uploadCertificateIfSelected(newTraining.staffId, newTraining.course);

      await addDoc(collection(db, TRAINING_COLLECTION), {
        staffId: newTraining.staffId,
        course: newTraining.course.trim(),
        provider: (newTraining.provider || "").trim(),
        completedOn: newTraining.completedOn || "",
        expiresOn: newTraining.expiresOn || "",
        certificateUrl: cert.certificateUrl,
        certificateName: cert.certificateName,
        notes: (newTraining.notes || "").trim(),
        site: site || "",
        deleted: false,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      });

      setNewTraining(emptyTraining);
      setCertificateFile(null);
    } catch (err) {
      console.error("save training failed:", err);
      alert("Could not save training record or upload certificate.");
    } finally {
      setUploading(false);
    }
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
      certificateName: t.certificateName || "",
      notes: t.notes || "",
    });
    setCertificateFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEditTraining = async () => {
    if (!trainingEdit?.staffId || !(trainingEdit.course || "").trim()) return;

    setUploading(true);

    try {
      const cert = await uploadCertificateIfSelected(trainingEdit.staffId, trainingEdit.course);

      await updateDoc(doc(db, TRAINING_COLLECTION, editingTrainingId), {
        staffId: trainingEdit.staffId,
        course: trainingEdit.course.trim(),
        provider: (trainingEdit.provider || "").trim(),
        completedOn: trainingEdit.completedOn || "",
        expiresOn: trainingEdit.expiresOn || "",
        certificateUrl: cert.certificateUrl,
        certificateName: cert.certificateName,
        notes: (trainingEdit.notes || "").trim(),
        site: site || "",
        deleted: false,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null,
      });

      setEditingTrainingId(null);
      setTrainingEdit(null);
      setCertificateFile(null);
    } catch (err) {
      console.error("edit training failed:", err);
      alert("Could not update training record or upload certificate.");
    } finally {
      setUploading(false);
    }
  };

  const delTraining = async (id) => {
    if (!window.confirm("Delete this training record?")) return;

    await updateDoc(doc(db, TRAINING_COLLECTION, id), {
      deleted: true,
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    });
  };

  return (
    <div style={wrap}>
      <h2 style={title}>
        Staff Training — <span style={{ color: "#2563eb" }}>{site}</span>
      </h2>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
          {editingStaffId ? "Edit Staff Member" : "Add Staff Member"}
        </div>

        <div style={row}>
          <input
            style={{ ...input, minWidth: 220, flex: 1 }}
            placeholder="Full name"
            value={workingStaff.name}
            onChange={(e) =>
              (editingStaffId ? setStaffEdit : setNewStaff)((p) => ({
                ...p,
                name: e.target.value,
              }))
            }
          />

          <input
            style={{ ...input, minWidth: 180 }}
            placeholder="Role"
            value={workingStaff.role}
            onChange={(e) =>
              (editingStaffId ? setStaffEdit : setNewStaff)((p) => ({
                ...p,
                role: e.target.value,
              }))
            }
          />

          <input
            style={{ ...input, minWidth: 220, flex: 1 }}
            placeholder="Contact email"
            value={workingStaff.contact}
            onChange={(e) =>
              (editingStaffId ? setStaffEdit : setNewStaff)((p) => ({
                ...p,
                contact: e.target.value,
              }))
            }
          />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {editingStaffId ? (
            <>
              <button onClick={saveEditStaff} style={blueBtn}>Save Changes</button>
              <button onClick={() => { setEditingStaffId(null); setStaffEdit(null); }} style={grayBtn}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={saveNewStaff} style={primaryBtn}>Add Staff</button>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
          {editingTrainingId ? "Edit Training Record" : "Add Training Record"}
        </div>

        <div style={row}>
          <select
            style={{ ...input, minWidth: 220 }}
            value={workingTraining.staffId}
            onChange={(e) =>
              (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({
                ...p,
                staffId: e.target.value,
              }))
            }
          >
            <option value="">Select staff member…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <input
            list="courseOptions"
            style={{ ...input, minWidth: 220, flex: 1 }}
            placeholder="Course"
            value={workingTraining.course}
            onChange={(e) =>
              (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({
                ...p,
                course: e.target.value,
              }))
            }
          />

          <datalist id="courseOptions">
            {COURSE_OPTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <input
            style={{ ...input, minWidth: 180 }}
            placeholder="Provider"
            value={workingTraining.provider}
            onChange={(e) =>
              (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({
                ...p,
                provider: e.target.value,
              }))
            }
          />

          <input
            type="date"
            style={{ ...input, minWidth: 160 }}
            value={workingTraining.completedOn}
            onChange={(e) =>
              (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({
                ...p,
                completedOn: e.target.value,
              }))
            }
          />

          <input
            type="date"
            style={{ ...input, minWidth: 160 }}
            value={workingTraining.expiresOn}
            onChange={(e) =>
              (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({
                ...p,
                expiresOn: e.target.value,
              }))
            }
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            style={{ ...input, width: "100%" }}
            onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
          />
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
            Attach certificate file. PDF, JPG or PNG recommended.
          </div>

          {workingTraining.certificateUrl ? (
            <div style={{ fontSize: 13, marginTop: 8 }}>
              Current certificate:{" "}
              <a
                href={workingTraining.certificateUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb", textDecoration: "underline" }}
              >
                {workingTraining.certificateName || "Open certificate"}
              </a>
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 8 }}>
          <textarea
            style={area}
            placeholder="Notes"
            value={workingTraining.notes}
            onChange={(e) =>
              (editingTrainingId ? setTrainingEdit : setNewTraining)((p) => ({
                ...p,
                notes: e.target.value,
              }))
            }
          />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {editingTrainingId ? (
            <>
              <button disabled={uploading} onClick={saveEditTraining} style={blueBtn}>
                {uploading ? "Uploading..." : "Save Changes"}
              </button>
              <button
                disabled={uploading}
                onClick={() => {
                  setEditingTrainingId(null);
                  setTrainingEdit(null);
                  setCertificateFile(null);
                }}
                style={grayBtn}
              >
                Cancel
              </button>
            </>
          ) : (
            <button disabled={uploading} onClick={saveNewTraining} style={primaryBtn}>
              {uploading ? "Uploading..." : "Add Training"}
            </button>
          )}
        </div>
      </div>

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

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Training Matrix</div>

        {staff.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No staff found for this site.</div>
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
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {s.name}{" "}
                          {s.role ? (
                            <span style={{ color: "#6b7280", fontWeight: 500 }}>— {s.role}</span>
                          ) : null}
                        </div>

                        {s.contact && (
                          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                            {s.contact}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => startEditStaff(s)} style={grayBtn}>Edit</button>
                        {s.active === false ? (
                          <button onClick={() => activateStaff(s.id)} style={primaryBtn}>Activate</button>
                        ) : (
                          <button onClick={() => deactivateStaff(s.id)} style={amberBtn}>Deactivate</button>
                        )}
                      </div>
                    </div>

                    {records.length === 0 ? (
                      <div style={{ color: "#6b7280", marginTop: 8, fontSize: 13 }}>
                        No training on record.
                      </div>
                    ) : (
                      <div style={{ marginTop: 10 }}>
                        {records.map((t) => {
                          const st = trainingStatus(t.expiresOn);

                          return (
                            <div
                              key={t.id}
                              style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 12,
                                padding: 10,
                                marginBottom: 8,
                                display: "grid",
                                gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
                                gap: 8,
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 600 }}>{t.course || "—"}</div>
                                <div style={{ fontSize: 12, color: "#6b7280" }}>
                                  {t.provider || "Provider —"}
                                </div>

                                {t.notes && (
                                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                                    {t.notes}
                                  </div>
                                )}

                                {t.certificateUrl && (
                                  <div style={{ fontSize: 12, marginTop: 4 }}>
                                    <a
                                      href={t.certificateUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: "#2563eb", textDecoration: "underline" }}
                                    >
                                      {t.certificateName || "Certificate"}
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

      {orphanTraining.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
            Training records with no matching staff member
          </div>

          {orphanTraining.map((t) => {
            const st = trainingStatus(t.expiresOn);

            return (
              <div key={t.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{t.course || "—"}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  staffId: {t.staffId || "—"}
                </div>

                {t.certificateUrl && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <a href={t.certificateUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
                      {t.certificateName || "Certificate"}
                    </a>
                  </div>
                )}

                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={st.style}>{st.label}</span>
                  <button onClick={() => startEditTraining(t)} style={grayBtn}>Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <button onClick={goBack} style={grayBtn}>
          Back
        </button>
      </div>
    </div>
  );
};

export default StaffTrainingSection;