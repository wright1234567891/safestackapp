import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  increment,
  Timestamp,
} from "firebase/firestore";

export default function FridgeLogSection({ site, user, equipment }) {
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    if (!site) return;
    const q = query(
      collection(db, "fridgeBatches"),
      where("site", "==", site),
      orderBy("useBy", "asc")
    );
    return onSnapshot(q, (snap) => {
      setBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [site]);

  const now = Date.now();

  const withStatus = useMemo(() => {
    return batches.map((b) => {
      const useByMs = b.useBy?.toDate?.()?.getTime?.() ?? null;
      let flag = "green";
      if (useByMs) {
        if (useByMs < now) flag = "red";
        else if (useByMs - now < 24 * 60 * 60 * 1000) flag = "amber";
      }
      return { ...b, flag };
    });
  }, [batches, now]);

  const markOpened = async (batchId) => {
    await updateDoc(doc(db, "fridgeBatches", batchId), {
      openedAt: serverTimestamp(),
    });
  };

  const reheat = async (batchId, currentReheats = 0, maxReheats = 1) => {
    if (currentReheats >= maxReheats) {
      alert("Already reheated the maximum allowed. Discard after service.");
      return;
    }
    await updateDoc(doc(db, "fridgeBatches", batchId), {
      reheats: increment(1),
    });
  };

  const discard = async (batchId) => {
    await updateDoc(doc(db, "fridgeBatches", batchId), {
      status: "DISCARDED",
      discardedAt: serverTimestamp(),
      discardedBy: user?.uid || null,
    });
  };

  return (
    <div>
      {/* render list by location, with green/amber/red dots and quick actions */}
    </div>
  );
}