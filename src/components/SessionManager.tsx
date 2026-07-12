"use client";

import { FormEvent, useMemo, useState } from "react";
import type { TreatmentSession } from "@/lib/types";

type SessionForm = {
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
  session_type: string;
  summary: string;
  sensitive_notes: string;
};

const emptyForm: SessionForm = {
  session_date: new Date().toISOString().slice(0, 10),
  start_time: "",
  end_time: "",
  location: "",
  session_type: "",
  summary: "",
  sensitive_notes: ""
};

function formatDate(value: string): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short"
  }).format(new Date(`${value}T00:00:00`));
}

export function SessionManager({
  patientId,
  initialSessions
}: {
  patientId: string;
  initialSessions: TreatmentSession[];
}): React.ReactElement {
  const [sessions, setSessions] = useState(initialSessions);
  const [form, setForm] = useState<SessionForm>(emptyForm);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const latestSessions = useMemo(() => sessions.slice(0, 5), [sessions]);

  function updateField(field: keyof SessionForm, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitSession(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    const response = await fetch(`/api/patients/${patientId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message || "לא ניתן היה לשמור מפגש.");
      return;
    }

    const body = (await response.json()) as { session: TreatmentSession };
    setSessions((current) =>
      [body.session, ...current].sort((a, b) =>
        `${b.session_date} ${b.start_time}`.localeCompare(
          `${a.session_date} ${a.start_time}`
        )
      )
    );
    setForm(emptyForm);
    setIsOpen(false);
    setMessage("המפגש נשמר.");
  }

  return (
    <div className="session-manager">
      <div className="panel-heading">
        <div>
          <h2>מפגשים</h2>
          <span>תיעוד טיפולי והיסטוריית מפגשים</span>
        </div>
        <button
          className="toolbar-button primary"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          מפגש חדש +
        </button>
      </div>

      {isOpen ? (
        <form className="session-form" onSubmit={submitSession}>
          <div className="form-grid session-form-grid">
            <div className="field">
              <label htmlFor="session_date">תאריך</label>
              <input
                id="session_date"
                name="session_date"
                onChange={(event) => updateField("session_date", event.target.value)}
                required
                type="date"
                value={form.session_date}
              />
            </div>
            <div className="field">
              <label htmlFor="start_time">משעה</label>
              <input
                id="start_time"
                name="start_time"
                onChange={(event) => updateField("start_time", event.target.value)}
                type="time"
                value={form.start_time}
              />
            </div>
            <div className="field">
              <label htmlFor="end_time">עד שעה</label>
              <input
                id="end_time"
                name="end_time"
                onChange={(event) => updateField("end_time", event.target.value)}
                type="time"
                value={form.end_time}
              />
            </div>
            <div className="field">
              <label htmlFor="location">מיקום</label>
              <input
                id="location"
                name="location"
                onChange={(event) => updateField("location", event.target.value)}
                value={form.location}
              />
            </div>
            <div className="field">
              <label htmlFor="session_type">סוג מפגש</label>
              <input
                id="session_type"
                name="session_type"
                onChange={(event) => updateField("session_type", event.target.value)}
                value={form.session_type}
              />
            </div>
            <div className="field wide">
              <label htmlFor="summary">סיכום מפגש</label>
              <textarea
                id="summary"
                name="summary"
                onChange={(event) => updateField("summary", event.target.value)}
                rows={3}
                value={form.summary}
              />
            </div>
            <div className="field wide">
              <label htmlFor="sensitive_notes">הערות רגישות</label>
              <textarea
                id="sensitive_notes"
                name="sensitive_notes"
                onChange={(event) =>
                  updateField("sensitive_notes", event.target.value)
                }
                rows={2}
                value={form.sensitive_notes}
              />
            </div>
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          <div className="toolbar">
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? "שומר..." : "שמירה"}
            </button>
            <button
              className="secondary-button"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              ביטול
            </button>
          </div>
        </form>
      ) : null}

      {message ? <div className="form-success session-message">{message}</div> : null}

      {latestSessions.length === 0 ? (
        <div className="empty-state compact">עדיין אין מפגשים בכרטיס.</div>
      ) : (
        <div className="session-list">
          {latestSessions.map((session) => (
            <article className="session-item" key={session.id}>
              <div>
                <strong>{formatDate(session.session_date)}</strong>
                <span>
                  {[session.start_time, session.end_time].filter(Boolean).join("-") ||
                    "ללא שעה"}
                </span>
              </div>
              <div>
                <strong>{session.session_type || "מפגש"}</strong>
                <span>{session.location || "ללא מיקום"}</span>
              </div>
              <p>{session.summary || "לא נכתב סיכום."}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
