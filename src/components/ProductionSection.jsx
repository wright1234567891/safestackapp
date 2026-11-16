import React, { useEffect, useState } from "react";
import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import "./ProductionSection.css";

const ZONE = "Europe/London";
const LIMIT = 150;
const blank = () => ({ title: "", time: "", endTime: "", quantity: "", assignedTo: "", notes: "" });
const dateInLondon = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const dayLabel = (date) => new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric",
}).format(new Date(`${date}T12:00:00Z`));
const clockInLondon = () => new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date());
const actor = (user) => ({ id: String(user?.uid || user?.id || ""), name: String(user?.name || user?.displayName || "Staff") });
const planOnly = (task) => ({
  title: task.title, time: task.time, endTime: task.endTime || "", quantity: task.quantity || "",
  assignedTo: task.assignedTo || "", notes: task.notes || "",
});
const freshTask = (task) => ({ ...planOnly(task), id: crypto.randomUUID(), status: "pending" });

export default function ProductionSection({ site, user, isManager = false, goBack }) {
  const [date, setDate] = useState(dateInLondon);
  if (!site) return <p>Select a site to view production.</p>;
  return (
    <div className="production">
      <header className="production-header">
        <div><button type="button" className="production-link" onClick={goBack}>← Back</button>
          <h1>Production Schedule</h1><p>{site} · Kitchen production</p></div>
        <label>Schedule date<input type="date" value={date} onChange={(e) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setDate(e.target.value);
        }} /></label>
      </header>
      <DayBoard key={`${site}:${date}`} {...{ site, date, user, isManager }} />
    </div>
  );
}

function DayBoard({ site, date, user, isManager }) {
  const [schedule, setSchedule] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("timeline");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [now, setNow] = useState(clockInLondon);
  const [today, setToday] = useState(dateInLondon);
  const ref = doc(db, "productionSchedules", `${site}_${date}`);
  const templateRef = doc(db, "productionTemplates", `${site}_${weekday(date)}`);

  useEffect(() => onSnapshot(ref, (snap) => {
    setSchedule(snap.exists() ? snap.data() : null);
    setLoaded(true); setLoadError("");
  }, () => { setLoaded(false); setLoadError("Could not load the schedule. Check your connection and Firebase permissions."); }), [site, date]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = setInterval(() => { setNow(clockInLondon()); setToday(dateInLondon()); }, 30000);
    return () => clearInterval(timer);
  }, []);

  const tasks = [...(schedule?.tasks || [])].sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
  const done = tasks.filter((task) => task.status === "completed").length;
  const editable = isManager && loaded && !busy;
  const act = async (operation, success) => {
    if (busy || !loaded) return;
    setBusy(true); setError(""); setMessage("");
    try { await operation(); setMessage(success); }
    catch (err) { setError(err?.message || "Could not save. Please try again."); }
    finally { setBusy(false); }
  };
  const changeDay = (transform) => runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const existing = snap.exists() ? snap.data() : { site, date, tasks: [] };
    if (existing.site !== site || existing.date !== date) throw new Error("Schedule does not match this site and date.");
    const nextTasks = transform(existing.tasks || []);
    if (nextTasks.length > LIMIT) throw new Error(`A schedule can contain up to ${LIMIT} jobs.`);
    transaction.set(ref, { site, date, tasks: nextTasks, updatedAt: serverTimestamp(), updatedBy: actor(user) }, { merge: true });
  });
  const saveTask = (event) => {
    event.preventDefault();
    if (!editable) return;
    const fields = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()]));
    if (!fields.title || !/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.time)) {
      setError("Enter a job name and a valid start time."); return;
    }
    if (fields.endTime && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.endTime) || fields.endTime <= fields.time)) {
      setError("Finish time must be later than start time on the same day."); return;
    }
    const id = editing?.id || crypto.randomUUID();
    act(async () => {
      await changeDay((current) => {
        if (!editing) return [...current, { ...fields, id, status: "pending" }];
        const latest = current.find((task) => task.id === id);
        if (!latest) throw new Error("This job has been removed. Cancel editing and refresh your plan.");
        if (JSON.stringify(planOnly(latest)) !== JSON.stringify(planOnly(editing))) {
          throw new Error("Another manager changed this job. Cancel editing and open it again.");
        }
        return current.map((task) => task.id === id ? { ...task, ...fields } : task);
      });
      setDraft(blank()); setEditing(null);
    }, editing ? "Job updated." : "Job added.");
  };
  const updateStatus = (task, next) => act(() => changeDay((current) => {
    const latest = current.find((item) => item.id === task.id);
    if (!latest) throw new Error("This job has been removed.");
    if (latest.status !== task.status) throw new Error("This job's status has changed. Check its latest status and try again.");
    return current.map((item) => item.id !== task.id ? item : {
      ...item, status: next, statusChangedAt: new Date().toISOString(), statusChangedBy: actor(user),
      completedAt: next === "completed" ? new Date().toISOString() : null,
      completedBy: next === "completed" ? actor(user) : null,
    });
  }), "Job status updated.");
  const saveTemplate = () => {
    if (!editable || !tasks.length) return;
    if (!window.confirm("Save this plan as the weekly template for this weekday? Any previous template for this site and weekday will be replaced. Completion ticks will not be copied.")) return;
    act(() => runTransaction(db, async (transaction) => {
      const latest = await transaction.get(ref);
      const rows = latest.data()?.tasks || [];
      if (!rows.length) throw new Error("There are no jobs to save.");
      transaction.set(templateRef, { site, weekday: weekday(date), tasks: rows.map(planOnly), updatedAt: serverTimestamp(), updatedBy: actor(user) });
    }), "Weekly template saved. Open another date of the same weekday and choose Load weekly plan.");
  };
  const loadTemplate = () => {
    if (!editable) return;
    act(() => runTransaction(db, async (transaction) => {
      const template = await transaction.get(templateRef);
      const day = await transaction.get(ref);
      if (!template.exists() || !template.data().tasks?.length) throw new Error("No weekly plan is saved for this site and weekday yet.");
      if ((day.data()?.tasks || []).length) throw new Error("Load the weekly plan into an empty day so existing jobs and progress are preserved.");
      const rows = template.data().tasks;
      if (rows.length > LIMIT) throw new Error("The weekly plan has too many jobs.");
      transaction.set(ref, { site, date, tasks: rows.map(freshTask), updatedAt: serverTimestamp(), updatedBy: actor(user) });
    }), "Weekly plan loaded. All jobs start as pending.");
  };

  const visible = tasks.filter((task) => {
    if (filter === "completed") return task.status === "completed";
    if (filter === "upcoming") return task.status === "pending" && date >= today && (date > today || task.time > now);
    if (filter === "due") return task.status !== "completed" && (task.status === "in_progress" || date < today || (date === today && task.time <= now));
    return true;
  });

  return (
    <>
      <section className="production-summary">
        <div><h2>{dayLabel(date)}</h2><p>{done} of {tasks.length} jobs completed · Times shown in UK time</p></div>
        <progress max={Math.max(tasks.length, 1)} value={done} aria-label="Jobs completed" />
      </section>
      {loadError && <p role="alert" className="production-error">{loadError}</p>}
      {error && <p role="alert" className="production-error">{error}</p>}
      <p role="status" aria-live="polite" className="production-message">{message}</p>
      {!loaded && !loadError && <p>Loading production schedule…</p>}
      {loaded && <>
        {isManager && <section className="production-planner">
          <div className="production-toolbar"><h2>{editing ? "Edit job" : "Plan production"}</h2>
            <div><button type="button" disabled={!editable || !tasks.length} onClick={saveTemplate}>Save weekly plan</button>
              <button type="button" disabled={!editable || tasks.length > 0} onClick={loadTemplate}>Load weekly plan</button></div>
          </div>
          <p>Save a weekday plan once, then load it into an empty date of the same weekday. Each date keeps its own progress.</p>
          <form onSubmit={saveTask} className="production-form">
            <label>Job name<input required maxLength={120} value={draft.title} placeholder="e.g. Cookie dough" onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            <label>Start time<input required type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
            <label>Finish time (optional)<input type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} /></label>
            <label>Quantity<input maxLength={80} value={draft.quantity} placeholder="e.g. 24 portions" onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></label>
            <label>Assigned to<input maxLength={100} value={draft.assignedTo} placeholder="Name or team" onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value })} /></label>
            <label className="production-wide">Preparation notes<textarea maxLength={1500} rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
            <div className="production-wide production-actions"><button className="production-primary" disabled={!editable} type="submit">{busy ? "Saving…" : editing ? "Save changes" : "Add job"}</button>
              {editing && <button type="button" disabled={busy} onClick={() => { setEditing(null); setDraft(blank()); }}>Cancel edit</button>}</div>
          </form>
        </section>}
        <div className="production-view-switch" role="group" aria-label="Schedule view">
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
          <button type="button" aria-pressed={view === "timeline"} onClick={() => setView("timeline")}>Timeline grid</button>
        </div>
        <nav className="production-filters" aria-label="Filter production jobs">
          {[["all", "Full day"], ["due", "Due / In progress"], ["upcoming", "Next"], ["completed", "Completed"]].map(([value, label]) =>
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </nav>
        {view === "timeline" && <ProductionTimeline tasks={visible} allTasks={tasks} now={now} isToday={date === today}
          selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} />}
        {view === "timeline" && visible.some((task) => task.id === selectedTaskId) &&
          <h2 className="production-selected-heading">Selected job</h2>}
        <div className="production-jobs" aria-busy={busy}>
          {!visible.length && <div className="production-empty">{tasks.length ? "No jobs in this view." : isManager ? "No production jobs yet. Add a job or load your weekly plan." : "No production schedule has been added for this date yet."}</div>}
          {visible.filter((task) => view === "list" || task.id === selectedTaskId).map((task) => {
            const complete = task.status === "completed";
            const started = task.status === "in_progress";
            const due = !complete && (date < today || (date === today && task.time <= now));
            return <article key={task.id} className={`production-job ${complete ? "is-complete" : started ? "is-started" : ""}`}>
              <div className="production-time">{task.time}{task.endTime && <small className="production-finish">to {task.endTime}</small>}</div>
              <div className="production-details"><div className="production-title"><h3>{task.title}</h3>
                <span className="production-badge">{complete ? "Completed" : started ? "In progress" : due ? "Due" : "Planned"}</span></div>
                <p>{[task.quantity, task.assignedTo && `Assigned to ${task.assignedTo}`].filter(Boolean).join(" · ") || "Team task"}</p>
                {task.notes && <p className="production-notes">{task.notes}</p>}
                {complete && task.completedBy?.name && <small>Completed by {task.completedBy.name}{task.completedAt && ` at ${new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(task.completedAt))}`}</small>}
              </div>
              <div className="production-actions">
                {!complete && !started && <button type="button" disabled={busy} onClick={() => updateStatus(task, "in_progress")}>Start</button>}
                {!complete && <button type="button" className="production-primary" disabled={busy} onClick={() => updateStatus(task, "completed")}>Complete</button>}
                {complete && <button type="button" disabled={busy} onClick={() => updateStatus(task, "pending")}>Reopen</button>}
                {isManager && <><button type="button" disabled={busy} onClick={() => { setEditing(task); setDraft(planOnly(task)); }}>Edit</button>
                  <button type="button" className="production-danger" disabled={busy} onClick={() => {
                    if (!window.confirm(`Remove “${task.title}” from this date?`)) return;
                    act(() => changeDay((current) => {
                      const latest = current.find((item) => item.id === task.id);
                      if (latest && JSON.stringify(latest) !== JSON.stringify(task)) throw new Error("This job changed. Check it before removing it.");
                      return current.filter((item) => item.id !== task.id);
                    }), "Job removed.");
                  }}>Remove</button></>}
              </div>
            </article>;
          })}
        </div>
        <p className="production-footnote">Changes appear automatically on connected staff devices. Saving requires an internet connection.</p>
      </>}
    </>
  );
}


// A start marker is used for legacy jobs with no finish time; no duration is invented.
const timeMinutes = (value) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};
const axisTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const taskRange = (task) => {
  const start = timeMinutes(task.time);
  const end = timeMinutes(task.endTime);
  return { start, end: start !== null && end !== null && end > start ? end : null };
};
const timelineBounds = (tasks) => {
  const points = tasks.flatMap((task) => {
    const { start, end } = taskRange(task);
    return [start, end].filter((point) => point !== null);
  });
  if (!points.length) return { start: 240, end: 600 };
  const start = Math.max(0, Math.floor(Math.min(...points) / 30) * 30 - 30);
  const end = Math.min(1440, Math.max(start + 120, Math.ceil(Math.max(...points) / 30) * 30 + 30));
  return { start, end };
};

function ProductionTimeline({ tasks, allTasks, now, isToday, selectedTaskId, onSelect }) {
  const { start, end } = timelineBounds(allTasks);
  const slotCount = Math.ceil((end - start) / 15);
  const width = slotCount * 54;
  const position = (minutes) => ((minutes - start) / (end - start)) * 100;
  const nowMinutes = timeMinutes(now);
  const showNow = isToday && nowMinutes !== null && nowMinutes >= start && nowMinutes <= end;
  const ticks = Array.from({ length: Math.ceil((end - start) / 30) }, (_, i) => start + i * 30);
  if (!tasks.length) return null;
  return <section className="production-timeline" aria-label="Production timeline grid">
    <div className="production-timeline-key">
      <span><i className="planned" />Planned</span><span><i className="started" />In progress</span>
      <span><i className="complete" />Completed</span><span>◆ Start only (no finish time)</span>
    </div>
    <p>Times run left to right in 15-minute columns. Select a job to see notes and update its status below. Scroll sideways for more times.</p>
    <div className="production-timeline-scroll" tabIndex={0} role="region" aria-label="Scrollable task timeline">
      <div className="production-timeline-canvas" style={{ width: width + 200 }}>
        <div className="production-axis-row">
          <div className="production-row-label production-axis-label">Task / staff</div>
          <div className="production-axis" style={{ width }}>
            {ticks.map((tick) => <span key={tick} style={{ left: `${position(tick)}%` }}>{axisTime(tick)}</span>)}
            <span className="production-axis-end">{axisTime(end)}</span>
          </div>
        </div>
        {tasks.map((task) => {
          const { start: taskStart, end: taskEnd } = taskRange(task);
          const status = task.status === "completed" ? "complete" : task.status === "in_progress" ? "started" : "planned";
          const label = `${task.title}, ${task.time}${taskEnd !== null ? ` to ${task.endTime}` : ", start only"}, ${status === "started" ? "in progress" : status === "complete" ? "completed" : "planned"}`;
          return <div key={task.id} className={`production-grid-row ${selectedTaskId === task.id ? "is-selected" : ""}`}>
            <button type="button" className="production-row-label" aria-pressed={selectedTaskId === task.id} onClick={() => onSelect(task.id)}>
              <strong>{task.title}</strong><small>{[task.assignedTo, task.quantity].filter(Boolean).join(" · ") || "Team task"}</small>
            </button>
            <div className="production-track" style={{ width, backgroundSize: `${100 / slotCount}% 100%` }}>
              {showNow && <span className="production-now-line" style={{ left: `${position(nowMinutes)}%` }} aria-hidden="true" />}
              {taskStart !== null && <button type="button" title={label} aria-label={label}
                aria-pressed={selectedTaskId === task.id} onClick={() => onSelect(task.id)}
                className={`production-bar ${status} ${taskEnd === null ? "is-marker" : ""}`}
                style={{ left: `${position(taskStart)}%`, ...(taskEnd !== null ? { width: `${position(taskEnd) - position(taskStart)}%` } : {}) }}>
                {taskEnd === null ? "◆" : <span>{task.time}–{task.endTime}</span>}
              </button>}
            </div>
          </div>;
        })}
      </div>
    </div>
    <p className="production-timeline-caption">{isToday ? `UK time now: ${now}${showNow ? " · Red line marks now." : " · Current time is outside the displayed range."}` : "Viewing a different date; the current-time line is hidden."}</p>
  </section>;
}
