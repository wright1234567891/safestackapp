import React, { useEffect, useMemo, useState } from "react";
import { FaChevronLeft, FaClock, FaCheckCircle, FaUtensils } from "react-icons/fa";
import { db } from "../firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

const toDate = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDateTime = (value) => {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusStyles = {
  new: { bg: "#fef3c7", color: "#92400e", label: "New" },
  preparing: { bg: "#dbeafe", color: "#1d4ed8", label: "Preparing" },
  prepared: { bg: "#dcfce7", color: "#15803d", label: "Prepared" },
  completed: { bg: "#e5e7eb", color: "#374151", label: "Completed" },
};

const PreOrdersSection = ({ goBack, site, user }) => {
  const [preOrders, setPreOrders] = useState([]);
  const [filter, setFilter] = useState("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "preOrders"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPreOrders(rows);
        setLoading(false);
      },
      (error) => {
        console.error("Pre-orders snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const tomorrowEnd = new Date(todayEnd);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    return preOrders
      .filter((order) => {
        if (site && order.site && order.site !== site) return false;

        const pickupDate = toDate(order.pickupDateTime || order.pickupDate || order.createdAt);

        if (filter === "all") return true;
        if (filter === "open") return !["prepared", "completed"].includes(order.status || "new");

        if (filter === "today") {
          return pickupDate && pickupDate >= todayStart && pickupDate <= todayEnd;
        }

        if (filter === "tomorrow") {
          return pickupDate && pickupDate >= tomorrowStart && pickupDate <= tomorrowEnd;
        }

        return true;
      })
      .sort((a, b) => {
        const aDate = toDate(a.pickupDateTime || a.pickupDate || a.createdAt)?.getTime() || 0;
        const bDate = toDate(b.pickupDateTime || b.pickupDate || b.createdAt)?.getTime() || 0;
        return aDate - bDate;
      });
  }, [preOrders, filter, site]);

  const updateStatus = async (orderId, status) => {
    try {
      await updateDoc(doc(db, "preOrders", orderId), {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: user?.name || user?.email || "Unknown",
      });
    } catch (error) {
      console.error("Error updating preorder:", error);
      alert("Could not update preorder.");
    }
  };

  return (
    <div>
      <button
        onClick={goBack}
        style={{
          border: "none",
          background: "transparent",
          color: "#0f172a",
          fontWeight: 800,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 18,
        }}
      >
        <FaChevronLeft /> Back
      </button>

      <div
        className="safestack-card"
        style={{
          padding: 24,
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: "#0f172a", fontSize: 32, fontWeight: 900 }}>
            Pre Orders
          </h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
            Check online pre-orders and mark them as prepared.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["today", "Today"],
            ["tomorrow", "Tomorrow"],
            ["open", "Open"],
            ["all", "All"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 999,
                padding: "9px 14px",
                background: filter === value ? "#15803d" : "#fff",
                color: filter === value ? "#fff" : "#0f172a",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="safestack-card" style={{ padding: 24, color: "#64748b" }}>
          Loading pre-orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="safestack-card" style={{ padding: 24, color: "#64748b" }}>
          No pre-orders found for this view.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {filteredOrders.map((order) => {
            const status = order.status || "new";
            const style = statusStyles[status] || statusStyles.new;
            const items = Array.isArray(order.items) ? order.items : [];

            return (
              <div key={order.id} className="safestack-card" style={{ padding: 20 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 14,
                    flexWrap: "wrap",
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                      {order.customerName || order.customer?.name || "Customer"}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        color: "#475569",
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <FaClock color="#15803d" />
                      {order.pickup || formatDateTime(order.pickupDateTime || order.pickupDate)}
                    </div>

                    {order.shopifyOrderName && (
                      <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
                        Shopify order: {order.shopifyOrderName}
                      </div>
                    )}
                  </div>

                  <span
                    style={{
                      alignSelf: "flex-start",
                      background: style.bg,
                      color: style.color,
                      borderRadius: 999,
                      padding: "7px 12px",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {style.label}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                  {items.length > 0 ? (
                    items.map((item, index) => (
                      <div
                        key={`${order.id}-${index}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "#f8fafc",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <FaUtensils color="#15803d" />
                          <strong style={{ color: "#0f172a" }}>
                            {item.title || item.productTitle || "Item"}
                          </strong>
                        </div>
                        <strong style={{ color: "#0f172a" }}>x{item.quantity || 1}</strong>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#64748b", fontSize: 14 }}>
                      No item details saved on this preorder.
                    </div>
                  )}
                </div>

                {order.notes && (
                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      color: "#92400e",
                      padding: 12,
                      borderRadius: 12,
                      marginBottom: 14,
                      fontSize: 14,
                    }}
                  >
                    <strong>Notes:</strong> {order.notes}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {status === "new" && (
                    <button
                      onClick={() => updateStatus(order.id, "preparing")}
                      style={{
                        border: "none",
                        borderRadius: 12,
                        padding: "10px 14px",
                        background: "#2563eb",
                        color: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Start preparing
                    </button>
                  )}

                  {status !== "prepared" && status !== "completed" && (
                    <button
                      onClick={() => updateStatus(order.id, "prepared")}
                      style={{
                        border: "none",
                        borderRadius: 12,
                        padding: "10px 14px",
                        background: "#15803d",
                        color: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <FaCheckCircle /> Mark prepared
                    </button>
                  )}

                  {status === "prepared" && (
                    <button
                      onClick={() => updateStatus(order.id, "completed")}
                      style={{
                        border: "none",
                        borderRadius: 12,
                        padding: "10px 14px",
                        background: "#0f172a",
                        color: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Mark collected
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PreOrdersSection;