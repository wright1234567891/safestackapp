// src/components/CCPSection.jsx
import React, { useEffect, useState } from "react";
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

const CCPSection = ({ site, goBack, user }) => {
  const [ccps, setCCPs] = useState([]);
  const [newCCPName, setNewCCPName] = useState("");
  const [editingCCP, setEditingCCP] = useState(null);
  const [editCCPName, setEditCCPName] = useState("");

  // Fetch CCPs for the site
  useEffect(() => {
    if (!site) return;
    const q = query(collection(db, "haccpPoints"), where("site", "==", site));
    const unsub = onSnapshot(q, (snapshot) => {
      setCCPs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [site]);

  // Add new CCP
  const addCCP = async () => {
    if (!newCCPName.trim()) return;
    await addDoc(collection(db, "haccpPoints"), {
      name: newCCPName.trim(),
      site,
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null,
    });
    setNewCCPName("");
  };

  // Start editing a CCP
  const startEditCCP = (ccp) => {
    setEditingCCP(ccp);
    setEditCCPName(ccp.name);
  };

  // Save edited CCP
  const saveEditCCP = async () => {
    if (!editCCPName.trim() || !editingCCP) return;
    const ref = doc(db, "haccpPoints", editingCCP.id);
    await updateDoc(ref, { name: editCCPName.trim() });
    setEditingCCP(null);
    setEditCCPName("");
  };

  // Delete CCP
  const deleteCCP = async (id) => {
    if (!window.confirm("Are you sure you want to delete this CCP?")) return;
    await deleteDoc(doc(db, "haccpPoints", id));
  };

  return (
    <div className="p-4 bg-white shadow rounded-xl">
      <h2 className="text-xl font-bold mb-4">Manage CCPs — {site}</h2>

      {/* Add new CCP */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="New CCP name"
          value={newCCPName}
          onChange={(e) => setNewCCPName(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <button
          onClick={addCCP}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Add
        </button>
      </div>

      {/* CCP list */}
      <ul className="space-y-2">
        {ccps.map((ccp) => (
          <li
            key={ccp.id}
            className="flex justify-between items-center border-b py-2"
          >
            {editingCCP?.id === ccp.id ? (
              <>
                <input
                  type="text"
                  value={editCCPName}
                  onChange={(e) => setEditCCPName(e.target.value)}
                  className="border p-1 rounded flex-1 mr-2"
                />
                <button
                  onClick={saveEditCCP}
                  className="bg-blue-600 text-white px-3 py-1 rounded mr-2"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingCCP(null)}
                  className="bg-gray-400 text-white px-3 py-1 rounded"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span>{ccp.name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditCCP(ccp)}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteCCP(ccp.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* Back button */}
      <button
        onClick={goBack}
        className="mt-6 bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
      >
        Back
      </button>
    </div>
  );
};

export default CCPSection;