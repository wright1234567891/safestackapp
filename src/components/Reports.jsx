import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  FaClipboardCheck,
  FaSnowflake,
  FaUsers,
  FaUserGraduate,
  FaThermometerHalf,
} from "react-icons/fa";

const Reports = ({ site }) => {
  const [equipmentRecords, setEquipmentRecords] = useState([]);
  const [staff, setStaff] = useState([]);
  const [trainingRecords, setTrainingRecords] = useState([]);
  const [fridgeBatches, setFridgeBatches] = useState([]);
  const [stockBatches, setStockBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribers = [];

    try {
      const equipmentQuery = query(
        collection(db, "equipment.records"),
        orderBy("createdAt", "desc")
      );

      unsubscribers.push(
        onSnapshot(equipmentQuery, (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setEquipmentRecords(data);
        })
      );
    } catch (err) {
      console.error("Equipment records error:", err);
    }

    try {
      unsubscribers.push(
        onSnapshot(collection(db, "stafflogin"), (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setStaff(data);
        })
      );
    } catch (err) {
      console.error("Staff error:", err);
    }

    try {
      unsubscribers.push(
        onSnapshot(collection(db, "trainingRecords"), (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setTrainingRecords(data);
        })
      );
    } catch (err) {
      console.error("Training records error:", err);
    }

    try {
      unsubscribers.push(
        onSnapshot(collection(db, "fridgeBatches"), (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setFridgeBatches(data);
        })
      );
    } catch (err) {
      console.error("Fridge batches error:", err);
    }

    try {
      unsubscribers.push(
        onSnapshot(collection(db, "stockBatches"), (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setStockBatches(data);
          setLoading(false);
        })
      );
    } catch (err) {
      console.error("Stock batches error:", err);
      setLoading(false);
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
    };
  }, [site]);

  const todaysTemps = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];

    return equipmentRecords.filter((record) => {
      if (!record.createdAt) return false;

      const date = record.createdAt?.seconds
        ? new Date(record.createdAt.seconds * 1000)
            .toISOString()
            .split("T")[0]
        : null;

      return date === today;
    });
  }, [equipmentRecords]);

  if (loading) {
    return (
      <div className="p-4 text-center">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">
          Reports Dashboard
        </h1>
        <p className="text-gray-600 text-sm">
          Site: {site || "All Sites"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Temperature Records
              </p>
              <h2 className="text-2xl font-bold">
                {todaysTemps.length}
              </h2>
            </div>
            <FaThermometerHalf className="text-2xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Staff Members
              </p>
              <h2 className="text-2xl font-bold">
                {staff.length}
              </h2>
            </div>
            <FaUsers className="text-2xl text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Training Records
              </p>
              <h2 className="text-2xl font-bold">
                {trainingRecords.length}
              </h2>
            </div>
            <FaUserGraduate className="text-2xl text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Fridge / Batch Logs
              </p>
              <h2 className="text-2xl font-bold">
                {fridgeBatches.length + stockBatches.length}
              </h2>
            </div>
            <FaSnowflake className="text-2xl text-cyan-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border p-4">
        <div className="flex items-center gap-2 mb-4">
          <FaClipboardCheck />
          <h2 className="text-xl font-semibold">
            Latest Temperature Records
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Equipment</th>
                <th className="py-2">Temperature</th>
                <th className="py-2">Staff</th>
              </tr>
            </thead>

            <tbody>
              {todaysTemps.slice(0, 10).map((record) => (
                <tr key={record.id} className="border-b">
                  <td className="py-2">
                    {record.equipmentName || "N/A"}
                  </td>
                  <td className="py-2">
                    {record.temperature || "N/A"}°C
                  </td>
                  <td className="py-2">
                    {record.staffName || "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;