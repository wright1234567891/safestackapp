// src/components/HaccpDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  FaClipboardCheck,
  FaExclamationTriangle,
  FaThermometerHalf,
  FaTools,
  FaBoxOpen,
  FaSearch,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

// -------------------------------
// Small helpers
// -------------------------------
const fmtDate = (ts) => {
  try {
    if (!ts) return "";
    if (ts.toDate) return ts.toDate().toLocaleString();
    if (typeof ts === "string") return ts;
    return "";
  } catch {
    return "";
  }
};

// Parse a number from "5", "5.0", "−2", etc.
const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\-\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// Support simple limitText like "≤5°C", "<=5", ">= 75C", "≥75 °C for 30s"
const parseLimitText = (s) => {
  if (!s) return null;
  const text = String(s).toLowerCase();
  const m = text.match(/(<=|≥|>=|≤|<|>|=)\s*([\-]?\d+(\.\d+)?)/);
  if (!m) return null;
  const op = m[1]
    .replace("≤", "<=")
    .replace("≥", ">=")
    .replace("=", "==");
  const val = toNum(m[2]);
  if (val === null) return null;
  return { op, val };
};

// Evaluate reading against CCP limits.
// Reading is a number in °C (string tolerated). Returns {ok, reason}
const evalAgainstLimits = (ccp, reading) => {
  const value = toNum(reading);
  if (value === null) return { ok: true, reason: "No reading" };

  // numeric min/max win if provided
  const min = toNum(ccp.limitMin);
  const max = toNum(ccp.limitMax);

  if (min !== null && value < min) {
    return { ok: false, reason: `Below min (${value}°C < ${min}°C)` };
  }
  if (max !== null && value > max) {
    return { ok: false, reason: `Above max (${value}°C > ${max}°C)` };
  }

  // else try text rule
  const rule = parseLimitText(ccp.limitText);
  if (rule) {
    const { op, val } = rule;
    // eslint-disable-next-line no-new-func
    const ok = Function("x", `return x ${op} ${val}`)(value);
    return ok
      ? { ok: true, reason: `Meets ${op} ${val}°C` }
      : { ok: false, reason: `Fails ${op} ${val}°C` };
  }

  // nothing to test against
  return { ok: true, reason: "No limits set" };
};

// Get the latest record from an equipment's records array
const latestRecord = (eq) => {
  const arr = Array.isArray(eq?.records) ? eq.records : [];
  if (!arr.length) return null;
  // records were saved with {id, temp, date, time, person}
  // build a sortable timestamp when possible
  const withWhen = arr.map((r) => {
    const when = r.when || `${r.date ?? ""} ${r.time ?? ""}`;
    return { ...r, _when: when };
  });
  // naive sort by index; most of your saves are append-at-end
  return withWhen[0]; // you saved newest last? or first? If wrong, switch to withWhen[withWhen.length-1]
};

// -------------------------------
// Component
// -------------------------------
const HaccpDashboard = ({ site, goBack }) => {
  const [ccps, setCCPs] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [stock, setStock] = useState([]);

  // UI
  const [qText, setQText] = useState("");
  const [onlyShow, setOnlyShow] = useState("ALL"); // ALL | OK | ALERT

  // Styles (match Stock/Checklist look)
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
    padding: "18px 18px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    marginBottom: "18px",
  };
  const sectionHeader = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontWeight: 700,
    fontSize: "16px",
    marginBottom: "14px",
  };
  const row = { display: "flex", gap: "10px", flexWrap: "wrap" };
  const input = {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    minWidth: "200px",
    background: "#fff",
  };
  const selectInput = { ...input, minWidth: 160 };
  const chip = (bg = "#eef2ff", fg = "#4338ca") => ({
    padding: "4px 8px",
    borderRadius: "999px",
    background: bg,
    color: fg,
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  });
  const badgeOK = chip("#ecfdf5", "#065f46");
  const badgeWarn = chip("#fef2f2", "#991b1b");
  const subtle = { fontSize: 13, color: "#6b7280" };

  // -------------------------------
  // Firestore listeners
  // -------------------------------
  useEffect(() => {
    if (!site) return;
    const qCCP = query(collection(db, "haccpPoints"), where("site", "==", site));
    const unsub = onSnapshot(qCCP, (snap) => {
      setCCPs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const qEq = query(collection(db, "equipment"), where("site", "==", site));
    const unsub = onSnapshot(qEq, (snap) => {
      setEquipment(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [site]);

  useEffect(() => {
    if (!site) return;
    const qStock = query(collection(db, "stockItems"), where("site", "==", site));
    const unsub = onSnapshot(qStock, (snap) => {
      setStock(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [site]);

  // -------------------------------
  // Derived rows (CCP x latest equipment reading)
  // -------------------------------
  const rows = useMemo(() => {
    const eqById = Object.fromEntries(equipment.map((e) => [e.id, e]));
    const stockById = Object.fromEntries(stock.map((s) => [s.id, s]));

    return ccps.map((c) => {
      const eqIds = c.equipmentIds || [];
      const siIds = c.stockItemIds || [];

      const linkedEquip = eqIds
        .map((id) => eqById[id])
        .filter(Boolean);

      const latestEvidences = linkedEquip.map((eq) => ({
        equipmentId: eq.id,
        equipmentName: eq.name || eq.type || eq.id,
        last: latestRecord(eq),
      }));

      // status: if ANY linked equipment has a last reading and it fails => ALERT
      let worst = { ok: true, reason: "No linked readings" };
      latestEvidences.forEach((evi) => {
        const res = evalAgainstLimits(c, evi.last?.temp);
        if (!res.ok) worst = res;
      });

      // build friendly strings
      const limitText =
        (c.limitMin || c.limitMax) ?
          [
            c.limitMin ? `Min ${c.limitMin}°C` : null,
            c.limitMax ? `Max ${c.limitMax}°C` : null
          ].filter(Boolean).join(" • ")
        : (c.limitText || "—");

      const stockNames = siIds
        .map((id) => stockById[id]?.name)
        .filter(Boolean)
        .join(", ");

      return {
        id: c.id,
        name: c.name || "(Unnamed CCP)",
        step: c.step || "",
        hazardType: c.hazardType || "—",
        isCCP: typeof c.isCCP === "boolean" ? c.isCCP : true,
        limits: limitText,
        equipments: latestEvidences,
        stockNames,
        status: worst.ok ? "OK" : "ALERT",
        statusReason: worst.reason,
      };
    });
  }, [ccps, equipment, stock]);

  const filtered = useMemo(() => {
    const t = qText.toLowerCase();
    return rows.filter((r) => {
      const matchesText =
        r.name.toLowerCase().includes(t) ||
        r.step.toLowerCase().includes(t) ||
        r.hazardType.toLowerCase().includes(t) ||
        r.limits.toLowerCase().includes(t) ||
        r.stockNames.toLowerCase().includes(t);
      const matchesStatus =
        onlyShow === "ALL" ? true : r.status === onlyShow;
      return matchesText && matchesStatus;
    });
  }, [rows, qText, onlyShow]);

  // -------------------------------
  // Render
  // -------------------------------
  return (
    <div style={wrap}>
      <h2 style={title}>
        HACCP Dashboard — <span style={{ color: "#2563eb" }}>{site}</span>
      </h2>

      {/* Filters */}
      <div style={card}>
        <div style={sectionHeader}>
          <FaSearch color="#111827" />
          Filters
        </div>
        <div style={row}>
          <input
            style={{ ...input, flex: 1, minWidth: 260 }}
            placeholder="Search CCPs (name, step, hazard, limits, stock)…"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />
          <select
            value={onlyShow}
            onChange={(e) => setOnlyShow(e.target.value)}
            style={selectInput}
          >
            <option value="ALL">All statuses</option>
            <option value="OK">OK only</option>
            <option value="ALERT">Alerts only</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div style={card}>
        <div style={sectionHeader}>
          <FaClipboardCheck color="#0ea5e9" />
          Summary
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={chip()}>
            Total CCPs: <strong>{ccps.length}</strong>
          </span>
          <span style={badgeOK}>
            <FaCheckCircle />
            OK: <strong>{rows.filter((r) => r.status === "OK").length}</strong>
          </span>
          <span style={badgeWarn}>
            <FaTimesCircle />
            Alerts: <strong>{rows.filter((r) => r.status === "ALERT").length}</strong>
          </span>
          <span style={chip("#ecfeff", "#0891b2")}>
            <FaTools />
            Equip linked:{" "}
            <strong>
              {
                [...new Set(ccps.flatMap((c) => c.equipmentIds || []))].length
              }
            </strong>
          </span>
          <span style={chip("#f5f3ff", "#6d28d9")}>
            <FaBoxOpen />
            Stock linked:{" "}
            <strong>
              {
                [...new Set(ccps.flatMap((c) => c.stockItemIds || []))].length
              }
            </strong>
          </span>
        </div>
      </div>

      {/* Table of CCPs */}
      <div style={card}>
        <div style={sectionHeader}>
          <FaThermometerHalf color="#16a34a" />
          CCPs & Latest Monitoring Evidence
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {[
                    "CCP / Control",
                    "Step",
                    "Hazard",
                    "Limits",
                    "Linked Equipment (latest)",
                    "Linked Stock",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={r.id} style={{ background: idx % 2 ? "#fafafa" : "#fff" }}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>
                      {r.name}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {r.step || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {r.hazardType}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {r.limits}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {r.equipments.length === 0 ? (
                        <span style={subtle}>No equipment linked</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {r.equipments.map((evi) => {
                            const last = evi.last;
                            if (!last)
                              return (
                                <div key={evi.equipmentId} style={subtle}>
                                  {evi.equipmentName}: no readings
                                </div>
                              );
                            return (
                              <div key={evi.equipmentId}>
                                <strong>{evi.equipmentName}</strong> — {last.temp ?? "?"}°C{" "}
                                <span style={subtle}>
                                  ({last.date} {last.time} {last.person ? `• ${last.person}` : ""})
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {r.stockNames || <span style={subtle}>—</span>}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {r.status === "OK" ? (
                        <span style={badgeOK}>
                          <FaCheckCircle /> OK
                        </span>
                      ) : (
                        <span style={badgeWarn}>
                          <FaTimesCircle /> Alert
                        </span>
                      )}
                      <div style={{ ...subtle, marginTop: 4 }}>{r.statusReason}</div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 14, textAlign: "center", color: "#6b7280" }}>
                      No results
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...subtle, marginTop: 10 }}>
          Status compares each CCP’s numeric limits (min/max) first, otherwise tries a simple rule
          in the text (e.g. “≤5°C”, “≥75°C”). We can expand this parser if you use other formats.
        </div>
      </div>

      {/* Back */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <button
          onClick={goBack}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            backgroundColor: "#f3f4f6",
            color: "#111",
            fontWeight: 600,
            transition: "all .2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default HaccpDashboard;