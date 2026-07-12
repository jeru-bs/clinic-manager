"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { Patient } from "@/lib/types";

const statusLabels: Record<Patient["status"], string> = {
  active: "פעיל",
  paused: "בהפסקה",
  completed: "הסתיים"
};

type PatientForm = {
  child_name: string;
  school_name: string;
  treatment_type: string;
  fixed_day: string;
  fixed_time: string;
  fixed_price: string;
  general_notes: string;
  sensitive_notes: string;
};

const emptyForm: PatientForm = {
  child_name: "",
  school_name: "",
  treatment_type: "",
  fixed_day: "",
  fixed_time: "",
  fixed_price: "",
  general_notes: "",
  sensitive_notes: ""
};

function formFromPatient(patient: Patient): PatientForm {
  return {
    child_name: patient.child_name,
    school_name: patient.school_name,
    treatment_type: patient.treatment_type,
    fixed_day: patient.fixed_day,
    fixed_time: patient.fixed_time,
    fixed_price: patient.fixed_price,
    general_notes: patient.general_notes,
    sensitive_notes: patient.sensitive_notes
  };
}

export function PatientManager({
  initialPatients
}: {
  initialPatients: Patient[];
}): React.ReactElement {
  const [patients, setPatients] = useState(initialPatients);
  const [form, setForm] = useState<PatientForm>(emptyForm);
  const [nameFilter, setNameFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Patient | null>(null);

  const activePatients = useMemo(
    () => patients.filter((patient) => patient.status === "active").length,
    [patients]
  );

  const filteredPatients = useMemo(
    () =>
      patients.filter((patient) => {
        const matchesName = patient.child_name.includes(nameFilter.trim());
        const matchesType = patient.treatment_type.includes(typeFilter.trim());
        const matchesDay = patient.fixed_day.includes(dayFilter.trim());
        return matchesName && matchesType && matchesDay;
      }),
    [dayFilter, nameFilter, patients, typeFilter]
  );

  function updateField(field: keyof PatientForm, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm(): void {
    setError("");
    setForm(emptyForm);
    setEditingPatient(null);
    setIsFormOpen(true);
  }

  function openEditForm(patient: Patient): void {
    setError("");
    setForm(formFromPatient(patient));
    setEditingPatient(patient);
    setIsFormOpen(true);
  }

  function closeForm(): void {
    setError("");
    setIsFormOpen(false);
    setEditingPatient(null);
    setForm(emptyForm);
  }

  async function submitPatient(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    const response = await fetch(
      editingPatient ? `/api/patients/${editingPatient.id}` : "/api/patients",
      {
      method: editingPatient ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
      }
    );

    setIsSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message || "לא ניתן היה לשמור מטופל.");
      return;
    }

    const body = (await response.json()) as { patient: Patient };
    setPatients((current) => {
      const nextPatients = editingPatient
        ? current.map((patient) =>
            patient.id === body.patient.id ? body.patient : patient
          )
        : [...current, body.patient];

      return nextPatients.sort((a, b) =>
        a.child_name.localeCompare(b.child_name, "he")
      );
    });
    setForm(emptyForm);
    setIsFormOpen(false);
    setEditingPatient(null);
    setMessage(editingPatient ? "פרטי המטופל עודכנו." : "המטופל נשמר במערכת.");
  }

  function resetFilters(): void {
    setNameFilter("");
    setTypeFilter("");
    setDayFilter("");
  }

  async function deleteSelectedPatient(): Promise<void> {
    if (!deleteCandidate) return;

    setError("");
    setMessage("");
    setIsSaving(true);

    const response = await fetch(`/api/patients/${deleteCandidate.id}`, {
      method: "DELETE"
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message || "לא ניתן היה למחוק מטופל.");
      return;
    }

    setPatients((current) =>
      current.filter((patient) => patient.id !== deleteCandidate.id)
    );
    setDeleteCandidate(null);
    setMessage("המטופל נמחק מהרשימה.");
  }

  return (
    <div className="patients-shell">
      <section className="toolbar-panel">
        <div className="toolbar">
          <button
            className="toolbar-button primary"
            onClick={openCreateForm}
            type="button"
          >
            הוסף מטופל +
          </button>
          <button className="toolbar-button blue" type="button">
            ייבוא
          </button>
          <button className="toolbar-button secondary" type="button">
            ייצוא
          </button>
          <button className="toolbar-button yellow" type="button">
            סינון
          </button>
          <button className="toolbar-button danger" onClick={resetFilters} type="button">
            נקה
          </button>
        </div>
      </section>

      {isFormOpen ? (
        <div className="patient-modal-backdrop" role="presentation">
          <section
            aria-labelledby="new-patient-title"
            aria-modal="true"
            className="patient-drawer"
            role="dialog"
          >
            <div className="section-heading">
              <h2 id="new-patient-title">
                {editingPatient ? "עריכת מטופל" : "הוספת מטופל"}
              </h2>
              <span>בהמשך יצירת מטופל תיצור גם תיקייה ב-Google Drive.</span>
            </div>

            <form className="patient-form" onSubmit={submitPatient}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="child_name">שם הילד</label>
                  <input
                    id="child_name"
                    name="child_name"
                    onChange={(event) => updateField("child_name", event.target.value)}
                    required
                    value={form.child_name}
                  />
                </div>

                <div className="field">
                  <label htmlFor="school_name">מוסד לימודים</label>
                  <input
                    id="school_name"
                    name="school_name"
                    onChange={(event) => updateField("school_name", event.target.value)}
                    value={form.school_name}
                  />
                </div>

                <div className="field">
                  <label htmlFor="treatment_type">סוג טיפול</label>
                  <input
                    id="treatment_type"
                    name="treatment_type"
                    onChange={(event) =>
                      updateField("treatment_type", event.target.value)
                    }
                    value={form.treatment_type}
                  />
                </div>

                <div className="field">
                  <label htmlFor="fixed_day">יום קבוע</label>
                  <input
                    id="fixed_day"
                    name="fixed_day"
                    onChange={(event) => updateField("fixed_day", event.target.value)}
                    value={form.fixed_day}
                  />
                </div>

                <div className="field">
                  <label htmlFor="fixed_time">שעה קבועה</label>
                  <input
                    id="fixed_time"
                    name="fixed_time"
                    onChange={(event) => updateField("fixed_time", event.target.value)}
                    type="time"
                    value={form.fixed_time}
                  />
                </div>

                <div className="field">
                  <label htmlFor="fixed_price">מחיר קבוע</label>
                  <input
                    id="fixed_price"
                    inputMode="decimal"
                    name="fixed_price"
                    onChange={(event) => updateField("fixed_price", event.target.value)}
                    value={form.fixed_price}
                  />
                </div>

                <div className="field wide">
                  <label htmlFor="general_notes">הערות כלליות</label>
                  <textarea
                    id="general_notes"
                    name="general_notes"
                    onChange={(event) =>
                      updateField("general_notes", event.target.value)
                    }
                    rows={2}
                    value={form.general_notes}
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
              {message ? <div className="form-success">{message}</div> : null}

              <div className="toolbar">
                <button className="primary-button" disabled={isSaving} type="submit">
                  {isSaving ? "שומר..." : "שמירה"}
                </button>
                <button
                  className="secondary-button"
                  onClick={closeForm}
                  type="button"
                >
                  ביטול
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {message && !isFormOpen ? <div className="form-success">{message}</div> : null}

      <section className="data-panel">
        <div className="panel-heading">
          <h2>מטופלים קיימים</h2>
          <span>
            {filteredPatients.length} מוצגים מתוך {patients.length} |{" "}
            {activePatients} פעילים
          </span>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>שם</th>
                <th>סוג טיפול</th>
                <th>יום ושעה קבועים</th>
                <th>מוסד לימודים</th>
                <th>סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              <tr className="filter-row">
                <td>
                  <input
                    className="table-filter"
                    onChange={(event) => setNameFilter(event.target.value)}
                    placeholder="חפש שם"
                    value={nameFilter}
                  />
                </td>
                <td>
                  <input
                    className="table-filter"
                    onChange={(event) => setTypeFilter(event.target.value)}
                    placeholder="סוג טיפול"
                    value={typeFilter}
                  />
                </td>
                <td>
                  <input
                    className="table-filter"
                    onChange={(event) => setDayFilter(event.target.value)}
                    placeholder="יום"
                    value={dayFilter}
                  />
                </td>
                <td />
                <td />
                <td>
                  <div className="table-actions">
                    <button className="table-action" onClick={resetFilters} type="button">
                      נקה
                    </button>
                  </div>
                </td>
              </tr>

              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">עדיין אין מטופלים להצגה.</div>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <div className="patient-name">{patient.child_name}</div>
                      <div className="patient-subtext">כרטיס מטופל בסיסי</div>
                    </td>
                    <td>{patient.treatment_type || "-"}</td>
                    <td>
                      {[patient.fixed_day, patient.fixed_time]
                        .filter(Boolean)
                        .join(" ") || "-"}
                    </td>
                    <td>{patient.school_name || "-"}</td>
                    <td>
                      <span className="status-pill">{statusLabels[patient.status]}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="table-action"
                          href={`/patients/${patient.id}`}
                          title="פתיחת כרטיס"
                        >
                          פתח
                        </Link>
                        <button
                          className="table-action edit"
                          onClick={() => openEditForm(patient)}
                          type="button"
                          title="עריכה"
                        >
                          ערוך
                        </button>
                        <button
                          className="table-action delete"
                          onClick={() => setDeleteCandidate(patient)}
                          type="button"
                          title="מחיקה"
                        >
                          מחק
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {deleteCandidate ? (
        <div className="patient-modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-patient-title"
            aria-modal="true"
            className="confirm-dialog"
            role="dialog"
          >
            <h2 id="delete-patient-title">מחיקת מטופל</h2>
            <p>
              למחוק את <strong>{deleteCandidate.child_name}</strong> מרשימת
              המטופלים?
            </p>
            <p className="dialog-warning">
              הפעולה תמחק את הרשומה מהמערכת. תיקיית Drive של המטופל לא תימחק
              אוטומטית.
            </p>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="toolbar">
              <button
                className="toolbar-button danger"
                disabled={isSaving}
                onClick={deleteSelectedPatient}
                type="button"
              >
                {isSaving ? "מוחק..." : "כן, למחוק"}
              </button>
              <button
                className="toolbar-button secondary"
                onClick={() => {
                  setError("");
                  setDeleteCandidate(null);
                }}
                type="button"
              >
                ביטול
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
