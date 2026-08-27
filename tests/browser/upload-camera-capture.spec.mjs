import { expect, test } from "@playwright/test";
import { patientRow, setupUiMocks } from "./helpers/ui-mocks.mjs";

const RECEIPT_IMAGE = {
  name: "receipt-photo.jpg",
  mimeType: "image/jpeg",
  buffer: Buffer.from("camera-receipt")
};
const RECEIPT_PDF = {
  name: "receipt.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("chosen-receipt")
};

async function openPaymentForm(page) {
  const mocks = await setupUiMocks(page, { seed: { patients: [patientRow("p1", "נועם", "300")] } });
  await page.goto("/#/patients/p1");
  await page.waitForLoadState("networkidle");
  await page.locator('[data-action="profile-tab"][data-tab="payments"]').first().click();
  await page.locator('[data-action="toggle-form"][data-form-key="payment"]').first().click();
  await expect(page.locator('form[data-form="payment"]')).toBeVisible();
  return mocks;
}

async function openBusinessForm(page) {
  const mocks = await setupUiMocks(page, { seed: { patients: [patientRow("p1", "נועם", "300")] } });
  await page.goto("/#/business");
  await page.waitForLoadState("networkidle");
  await page.locator('[data-action="toggle-form"][data-form-key="business"]').first().click();
  await expect(page.locator('form[data-form="business-record"]')).toBeVisible();
  return mocks;
}

test("the payment receipt camera input carries the mobile capture attributes", async ({ page }) => {
  await openPaymentForm(page);
  const camera = page.locator("#receipt_upload_camera");
  await expect(camera).toHaveAttribute("accept", "image/*");
  await expect(camera).toHaveAttribute("capture", "environment");
  await expect(camera).toHaveAttribute("type", "file");
  // The camera option is a labelled control next to the unchanged file input.
  await expect(page.locator('label[for="receipt_upload_camera"]')).toHaveText("צילום מהמצלמה");
  await expect(page.locator("#receipt_upload")).toBeAttached();
});

test("the business document camera input carries the mobile capture attributes", async ({ page }) => {
  await openBusinessForm(page);
  const camera = page.locator("#business_document_camera");
  await expect(camera).toHaveAttribute("accept", "image/*");
  await expect(camera).toHaveAttribute("capture", "environment");
  await expect(page.locator('label[for="business_document_camera"]')).toHaveText("צילום מהמצלמה");
  await expect(page.locator("#business_document")).toBeAttached();
});

test("camera and regular receipt selections are mutually exclusive and show the Hebrew filename", async ({ page }) => {
  await openPaymentForm(page);
  await page.locator("#receipt_upload").setInputFiles(RECEIPT_PDF);
  await expect(page.locator('[data-upload-name="receipt_upload"]')).toHaveText("receipt.pdf");

  await page.locator("#receipt_upload_camera").setInputFiles(RECEIPT_IMAGE);
  await expect(page.locator('[data-upload-name="receipt_upload_camera"]')).toHaveText("receipt-photo.jpg");
  // Choosing a camera image clears whatever the regular input was holding.
  await expect(page.locator('[data-upload-name="receipt_upload"]')).toHaveText("לא נבחר קובץ");
  expect(await page.locator("#receipt_upload").evaluate((node) => node.files.length)).toBe(0);

  await page.locator("#receipt_upload").setInputFiles(RECEIPT_PDF);
  await expect(page.locator('[data-upload-name="receipt_upload_camera"]')).toHaveText("לא נבחר קובץ");
  expect(await page.locator("#receipt_upload_camera").evaluate((node) => node.files.length)).toBe(0);
});

test("camera and regular business-document selections are mutually exclusive", async ({ page }) => {
  await openBusinessForm(page);
  const cameraImage = { name: "invoice-photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("camera-invoice") };
  const chosenPdf = { name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("chosen-invoice") };

  await page.locator("#business_document_camera").setInputFiles(cameraImage);
  await expect(page.locator('[data-upload-name="business_document_camera"]')).toHaveText("invoice-photo.jpg");
  // A camera image satisfies the required upload, so the regular input no longer blocks the form.
  expect(await page.locator("#business_document").evaluate((node) => node.required)).toBe(false);

  await page.locator("#business_document").setInputFiles(chosenPdf);
  await expect(page.locator('[data-upload-name="business_document"]')).toHaveText("invoice.pdf");
  await expect(page.locator('[data-upload-name="business_document_camera"]')).toHaveText("לא נבחר קובץ");
  expect(await page.locator("#business_document_camera").evaluate((node) => node.files.length)).toBe(0);
  expect(await page.locator("#business_document").evaluate((node) => node.required)).toBe(true);
});
