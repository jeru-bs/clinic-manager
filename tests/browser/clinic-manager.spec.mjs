import { expect, test } from "@playwright/test";

test("the access gate does not expose the authorized email list", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "התחברות לחשבון מורשה" })).toBeVisible();
  await expect(page.getByText("הכניסה מוגבלת לחשבונות Google שאושרו מראש.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("azaidman1@gmail.com");
  await expect(page.locator("body")).not.toContainText("malki.frankel@gmail.com");
});

test("a blocked Google popup produces an actionable Hebrew error", async ({ page }) => {
  await page.route("https://accounts.google.com/gsi/client", async (route) => {
    await route.fulfill({
      contentType: "text/javascript",
      body: `window.google={accounts:{oauth2:{initTokenClient(options){return{requestAccessToken(){options.error_callback({type:"popup_failed_to_open"});}};}}}};`
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "התחברות לחשבון מורשה" }).click();

  await expect(page.getByText("חלון Google נחסם על ידי הדפדפן. יש לאפשר חלונות קופצים לאתר ולנסות שוב.")).toBeVisible();
});

test("settings remain readable and operable on the configured viewport", async ({ page, isMobile }) => {
  await page.goto("/#/settings");

  await page.getByRole("button", { name: "חיבורים ואינטגרציות" }).click();
  await expect(page.getByLabel("מזהה התחברות")).toBeVisible();
  await page.getByRole("button", { name: "אבטחה ויומן פעילות" }).click();
  await expect(page.getByLabel("חשבונות Google מורשים")).toBeVisible();
  const connectButton = page.getByRole("button", { name: "התחברות לאחסון" });
  await expect(connectButton).toBeVisible();

  if (isMobile) {
    const buttonBox = await connectButton.boundingBox();
    expect(buttonBox?.height || 0).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("the Israel calendar requests and caches Hebrew Hebcal holidays", async ({ page }) => {
  const year = new Date().getFullYear();
  let requestedUrl = "";
  await page.route("https://www.hebcal.com/hebcal?**", async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            date: `${year}-09-21`,
            category: "holiday",
            subcat: "major",
            hebrew: "יום כיפור",
            yomtov: true,
            link: "https://www.hebcal.com/"
          }
        ]
      })
    });
  });

  await page.goto("/#/calendar");

  await expect.poll(() => requestedUrl).toContain("i=on");
  expect(requestedUrl).toContain("lg=he");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), `clinic-manager-hebcal-israel-${year}`))
    .toContain("יום כיפור");
});

test("parents and professionals can be viewed and edited from the patient card", async ({ page }) => {
  let responseReady = false;
  let questionnaireClosed = false;
  const generatedReportContents = [];
  const appendedRows = {};
  let documentSequence = 0;
  const headers = {
    patients: ["id", "child_name", "address", "school_name", "treatment_type", "fixed_price", "fixed_day", "fixed_time", "treatment_goals", "sensitive_notes", "general_notes", "status", "default_payment_method", "payment_status", "receipt_status", "drive_folder_id", "drive_folder_path", "created_at", "updated_at", "fixed_start_date", "fixed_end_date"],
    sessions: ["id", "patient_id", "session_date", "start_time", "end_time", "location", "session_type", "summary", "sensitive_notes", "calendar_event_id", "created_at", "updated_at", "document_file_id", "next_plan", "status"],
    payments: ["id", "patient_id", "session_id", "amount", "payment_method", "payment_status", "receipt_status", "paid_at", "receipt_file_id", "notes", "created_at", "updated_at"],
    tasks: ["id", "patient_id", "title", "description", "status", "due_date", "source", "created_at", "updated_at", "reminder_at", "task_key"],
    files: ["id", "patient_id", "drive_file_id", "drive_folder_id", "name", "file_type", "url", "created_at", "updated_at"],
    contacts: ["id", "patient_id", "contact_type", "name", "relationship", "phone", "email", "organization", "notes", "created_at", "updated_at"],
    goals: ["id", "patient_id", "title", "description", "status", "progress", "target_date", "note", "legacy_source", "created_at", "updated_at"],
    goal_updates: ["id", "goal_id", "patient_id", "session_id", "progress", "status", "note", "created_at", "updated_at", "outcome"],
    questionnaire_templates: ["id", "name", "audience", "questions_json", "active", "created_at", "updated_at"],
    questionnaire_assignments: ["id", "patient_id", "contact_id", "template_id", "form_id", "responder_url", "status", "sent_at", "due_date", "responded_at", "last_response_id", "created_at", "updated_at"],
    questionnaire_responses: ["id", "assignment_id", "patient_id", "contact_id", "response_id", "submitted_at", "answers_json", "reviewed_at", "created_at", "updated_at"],
    clinical_reports: ["id", "patient_id", "report_type", "title", "period_start", "period_end", "content", "document_file_id", "pdf_file_id", "created_at", "updated_at"],
    schedule_exceptions: ["id", "patient_id", "exception_type", "start_date", "end_date", "reason", "created_at", "updated_at", "moved_to_date", "moved_to_time"],
    business_records: ["id", "document_date", "record_type", "amount", "drive_file_id", "drive_folder_id", "file_name", "file_url", "source", "payment_id", "created_at", "updated_at"],
    session_charges: ["id", "session_id", "patient_id", "session_date", "amount", "created_at", "updated_at"],
    payment_allocations: ["id", "payment_id", "charge_id", "session_id", "patient_id", "amount", "created_at", "updated_at"],
    audit_log: ["id", "action_type", "entity_type", "entity_id", "summary", "actor_email", "mutations_json", "undoable", "undone_at", "created_at"]
  };
  const patientRow = ["p1", "נועם", "", "בית ספר", "רגשי", "", "", "", "חיזוק ביטחון עצמי", "אסור לפרסום", "", "active", "bank_transfer", "unpaid", "needed", "folder1", "", "2026-01-01", "2026-01-01", "", ""];
  const contactRow = ["c1", "p1", "professional", "דנה כהן", "קלינאית תקשורת", "0501234567", "dana@example.com", "בית ספר", "לתיאום ישיר", "2026-01-01", "2026-01-01"];

  await page.addInitScript(() => {
    sessionStorage.setItem(
      "clinic-manager-google-token",
      JSON.stringify({ accessToken: "test-token", expiresAt: Date.now() + 60 * 60 * 1000 })
    );
  });
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "window.google={accounts:{oauth2:{}}};" })
  );
  await page.route("https://sheets.googleapis.com/**", async (route) => {
    const request = route.request();
    const decoded = decodeURIComponent(request.url());
    if (decoded.includes("fields=sheets.properties.title")) {
      return route.fulfill({ json: { sheets: Object.keys(headers).map((title) => ({ properties: { title } })) } });
    }
    const headerEntry = Object.entries(headers).find(([sheet]) => decoded.includes(`${sheet}!1:1`));
    if (headerEntry) return route.fulfill({ json: { values: [headerEntry[1]] } });
    if (request.method() === "GET" && decoded.includes("patients!A2:")) {
      return route.fulfill({ json: { values: [patientRow] } });
    }
    if (request.method() === "GET" && decoded.includes("contacts!A2:")) {
      return route.fulfill({ json: { values: [contactRow] } });
    }
    if (request.method() === "GET" && decoded.includes("questionnaire_assignments!A2:")) {
      return route.fulfill({ json: { values: appendedRows.questionnaire_assignments || [] } });
    }
    if (request.method() === "GET" && decoded.includes("values/")) {
      return route.fulfill({ json: { values: [] } });
    }
    if (decoded.includes(":append")) {
      const sheet = decoded.match(/values\/([^!]+)!/)?.[1] || "audit_log";
      appendedRows[sheet] ||= [];
      appendedRows[sheet].push(...(request.postDataJSON()?.values || []));
      return route.fulfill({ json: { updates: { updatedRange: `${sheet}!A2:K2` } } });
    }
    return route.fulfill({ json: {} });
  });
  await page.route("https://www.googleapis.com/**", async (route) => {
    const request = route.request();
    const url = request.url();
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Content-Range, X-Upload-Content-Type, X-Upload-Content-Length",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Expose-Headers": "Location, Range"
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    if (url.includes("/oauth2/v3/userinfo")) {
      return route.fulfill({ json: { email: "azaidman1@gmail.com", name: "אהרן", email_verified: true } });
    }
    if (url.includes("/permissions")) return route.fulfill({ json: { permissions: [] } });
    if (url.includes("/upload/mock-session") && request.method() === "PUT") {
      return route.fulfill({ headers: corsHeaders, json: { id: `pdf-${documentSequence}`, name: `report-${documentSequence}.pdf`, webViewLink: `https://drive.google.com/pdf-${documentSequence}` } });
    }
    if (url.includes("/upload/drive/v3/files") && request.method() === "POST") {
      return route.fulfill({ status: 200, headers: { ...corsHeaders, Location: "https://www.googleapis.com/upload/mock-session" }, body: "" });
    }
    if (url.includes("/export?") && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.4 mocked report" });
    }
    if (url.includes("/drive/v3/files") && request.method() === "POST") {
      documentSequence += 1;
      return route.fulfill({ json: { id: `doc-${documentSequence}`, name: `report-${documentSequence}`, webViewLink: `https://docs.google.com/document/d/doc-${documentSequence}` } });
    }
    if (url.includes("/drive/v3/files")) return route.fulfill({ json: { files: [] } });
    return route.fulfill({ json: {} });
  });
  await page.route("https://docs.googleapis.com/**", async (route) => {
    const body = route.request().postDataJSON();
    generatedReportContents.push(body?.requests?.[0]?.insertText?.text || "");
    return route.fulfill({ json: {} });
  });
  await page.route("https://forms.googleapis.com/**", async (route) => {
    const request = route.request();
    const url = request.url();
    if (request.method() === "POST" && url.includes("/v1/forms?") ) {
      return route.fulfill({ json: { formId: "form-1" } });
    }
    if (request.method() === "POST" && url.includes(":setPublishSettings")) {
      questionnaireClosed ||= request.postDataJSON()?.publishSettings?.publishState?.isAcceptingResponses === false;
      return route.fulfill({ json: {} });
    }
    if (request.method() === "GET" && url.endsWith("/v1/forms/form-1")) {
      return route.fulfill({ json: { formId: "form-1", responderUri: "https://docs.google.com/forms/d/form-1/viewform", items: [{ title: "מה השתנה?", questionItem: { question: { questionId: "q1" } } }] } });
    }
    if (request.method() === "GET" && url.includes("/responses")) {
      return route.fulfill({ json: responseReady ? { responses: [{ responseId: "response-1", lastSubmittedTime: "2026-08-19T09:00:00Z", answers: { q1: { textAnswers: { answers: [{ value: "יש שיפור ברור" }] } } } }] } : { responses: [] } });
    }
    return route.fulfill({ json: {} });
  });

  await page.goto("/#/patients/p1");
  await page.getByRole("button", { name: "הורים ואנשי מקצוע" }).click();
  await expect(page.getByText("דנה כהן")).toBeVisible();
  await expect(page.getByRole("link", { name: "0501234567" })).toBeVisible();
  await page.getByRole("button", { name: "עריכה" }).click();
  await page.getByLabel("קרבה או תפקיד").fill("רכזת טיפול");
  await page.getByRole("button", { name: "שמירת שינויים" }).click();
  await expect(page.getByText("פרטי איש הקשר עודכנו.")).toBeVisible();

  await page.getByRole("button", { name: "מטרות" }).click();
  await expect(page.getByText("מטרות קיימות")).toBeVisible();
  await expect(page.getByText("חיזוק ביטחון עצמי")).toBeVisible();
  await page.getByLabel("כותרת").fill("שיפור השתתפות חברתית");
  await page.getByLabel("התקדמות").fill("25");
  await page.getByRole("button", { name: "שמירת מטרה" }).click();
  await expect(page.getByText("מטרת הטיפול נשמרה.")).toBeVisible();
  await expect(page.getByText("שיפור השתתפות חברתית")).toBeVisible();

  await page.getByRole("button", { name: "שאלונים" }).click();
  await page.getByLabel("נמען").selectOption("c1");
  await page.getByLabel("תבנית", { exact: true }).selectOption("default-parent-questionnaire");
  await page.getByRole("button", { name: "יצירת שאלון וקישור" }).click();
  await expect(page.getByText("השאלון נוצר. אפשר לשלוח אותו ב-WhatsApp או במייל.")).toBeVisible();
  await expect(page.getByRole("link", { name: "פתיחת טופס" })).toBeVisible();
  responseReady = true;
  await page.getByRole("button", { name: "רענון תשובות" }).click();
  await expect(page.getByText("נקלטו 1 תשובות חדשות.")).toBeVisible();
  await page.getByText("הצגת תשובות").click();
  await expect(page.getByText("יש שיפור ברור")).toBeVisible();
  expect(questionnaireClosed).toBe(true);

  await page.getByRole("button", { name: "דוחות טיפוליים" }).click();
  await expect(page.getByRole("button", { name: "יצירת Google Doc ו-PDF" })).toBeVisible();
  await expect(page.getByLabel("תוכן לעריכה")).not.toContainText("הערות פנימיות");
  await expect(page.getByLabel("תוכן לעריכה")).not.toContainText("אסור לפרסום");
  const reportCases = [["assessment", "דוח אבחון"], ["progress", "דוח התקדמות"], ["summary", "דוח סיכום טיפול"]];
  for (const [index, [type, title]] of reportCases.entries()) {
    await page.getByLabel("סוג דוח").selectOption(type);
    await page.getByLabel("כותרת").fill(title);
    await page.getByRole("button", { name: "יצירת Google Doc ו-PDF" }).click();
    await expect.poll(() => generatedReportContents.length).toBe(index + 1);
    await expect(page.getByText("הדוח הופק ונשמר כ-Google Doc וכ-PDF בתיק המטופל.")).toBeVisible();
  }
  expect(generatedReportContents).toHaveLength(3);
  expect(generatedReportContents.every((content) => !content.includes("אסור לפרסום"))).toBe(true);
  await expect(page.getByRole("link", { name: "Google Doc" })).toHaveCount(3);
  await expect(page.getByRole("link", { name: "PDF" })).toHaveCount(3);
});
