import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp
} from "firebase/firestore";

export default function HowToSection({ site, user, goBack }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "dishes"), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const addItem = async () => {
    if (!name) return;

    await addDoc(collection(db, "dishes"), {
      site,
      name,
      steps: steps.split("\n"),
      createdAt: serverTimestamp(),
      createdBy: user?.uid || null
    });

    setName("");
    setSteps("");
  };

  return (
    <div style={{ padding: 20 }}>
      <button onClick={goBack}>Back</button>

      <h2>How-To Guides</h2>

      <input
        placeholder="Dish or drink name"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <textarea
        placeholder="One step per line"
        value={steps}
        onChange={e => setSteps(e.target.value)}
      />

      <button onClick={addItem}>Save</button>

      <hr />

      {items.map(i => (
        <div key={i.id}>
          <h3>{i.name}</h3>
          <ol>
            {i.steps?.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}