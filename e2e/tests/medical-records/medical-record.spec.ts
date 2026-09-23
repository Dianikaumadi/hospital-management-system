import { test, expect, storageStatePath } from '../../fixtures';
import { MedicalRecordsPage } from '../../pages';
import { errorBody } from '../../api/ApiClient';
import { endpoints } from '../../api/endpoints';
import type { MedicalRecord } from '../../api/types';
import { buildMedicalRecord, buildPrescription } from '../../fixtures/medical-records';
import { env } from '../../config/env';
import { users } from '../../fixtures/users';

test.describe('Medical records (doctor)', () => {
  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke doctor logs in through the UI and the session can create a medical record', async ({ page, loginPage, dashboardPage, data, session }) => {
    const patient = await data.patient();

    await loginPage.open();
    await loginPage.loginAs(users.doctor);
    await expect(dashboardPage.title).toBeVisible();
    await expect(dashboardPage.shell.userRole).toHaveText('Doctor');

    // Use the token the UI stored, exactly as the SPA does for its own calls.
    const token = await page.evaluate(() => localStorage.getItem('hms_token'));
    expect(token).toBeTruthy();
    const response = await page.request.post(`${env.apiBase}/${endpoints.medicalRecords}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: buildMedicalRecord(patient.id, { doctorId: session.doctorId })
    });

    expect(response.status()).toBe(201);
    const record = (await response.json()).data as MedicalRecord;
    data.track('medical_records', record.id);
    expect(record).toMatchObject({ patientId: patient.id, doctorId: session.doctorId });
  });

  test('creates a record with diagnosis, treatment, prescription and report URL', async ({ api, data, session }) => {
    const patient = await data.patient();
    const input = buildMedicalRecord(patient.id, { doctorId: session.doctorId });

    const response = await api.doctor.post(endpoints.medicalRecords, input);

    expect(response.status()).toBe(201);
    const created = (await response.json()).data as MedicalRecord;
    data.track('medical_records', created.id);
    expect(created).toMatchObject({
      patientId: patient.id, doctorId: session.doctorId, diagnosis: input.diagnosis, treatment: input.treatment,
      prescription: input.prescription, reportUrl: input.reportUrl
    });

    // Persisted exactly as sent, including the nested prescription
    const saved = await api.doctor.getData<MedicalRecord>(`${endpoints.medicalRecords}/${created.id}`);
    expect(saved.prescription).toHaveLength(2);
    expect(saved.prescription![0]).toEqual({ medicine: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: 'Three times daily', durationDays: 5 });
    expect(saved.reportUrl).toBe(input.reportUrl);
  });

  test('builds a record step by step: diagnosis, then treatment, prescription and report URL', async ({ api, data, session }) => {
    const patient = await data.patient();

    // 1. Diagnosis only
    const created = await data.medicalRecord({ patientId: patient.id, doctorId: session.doctorId, diagnosis: 'E2E Hypertension', treatment: undefined, prescription: undefined, reportUrl: undefined });
    expect(created).toMatchObject({ diagnosis: 'E2E Hypertension', treatment: null, prescription: null, reportUrl: null });
    const url = `${endpoints.medicalRecords}/${created.id}`;

    // 2. Add treatment
    let record = await api.doctor.patchData<MedicalRecord>(url, { treatment: 'Low-salt diet and daily walking' });
    expect(record).toMatchObject({ diagnosis: 'E2E Hypertension', treatment: 'Low-salt diet and daily walking' });

    // 3. Add prescription
    const prescription = buildPrescription();
    record = await api.doctor.patchData<MedicalRecord>(url, { prescription });
    expect(record.prescription).toEqual(prescription);

    // 4. Attach report URL
    record = await api.doctor.patchData<MedicalRecord>(url, { reportUrl: 'https://reports.hms-e2e.test/bp-chart.pdf' });

    // Everything accumulated, nothing lost
    const saved = await api.doctor.getData<MedicalRecord>(url);
    expect(saved).toMatchObject({
      diagnosis: 'E2E Hypertension', treatment: 'Low-salt diet and daily walking', prescription, reportUrl: 'https://reports.hms-e2e.test/bp-chart.pdf'
    });
  });

  test('amending the diagnosis keeps the rest of the record', async ({ api, data }) => {
    const record = await data.medicalRecord();

    const updated = await api.doctor.patchData<MedicalRecord>(`${endpoints.medicalRecords}/${record.id}`, { diagnosis: 'E2E Chronic bronchitis' });

    expect(updated).toMatchObject({ diagnosis: 'E2E Chronic bronchitis', treatment: record.treatment, reportUrl: record.reportUrl });
    expect(updated.prescription).toEqual(record.prescription);
  });

  test('patient history lists every record of that patient, newest first, and no one else\'s', async ({ api, data }) => {
    const patient = await data.patient();
    const stranger = await data.patient();
    const first = await data.medicalRecord({ patientId: patient.id, diagnosis: 'E2E Visit 1 - Influenza' });
    const second = await data.medicalRecord({ patientId: patient.id, diagnosis: 'E2E Visit 2 - Sinusitis' });
    const third = await data.medicalRecord({ patientId: patient.id, diagnosis: 'E2E Visit 3 - Recovery' });
    const other = await data.medicalRecord({ patientId: stranger.id, diagnosis: 'E2E Someone else' });

    const history = (await api.doctor.list<MedicalRecord>(endpoints.medicalRecords)).filter((r) => r.patientId === patient.id);

    expect(history.map((r) => r.id)).toEqual([third.id, second.id, first.id]);
    expect(history.map((r) => r.diagnosis)).toEqual(['E2E Visit 3 - Recovery', 'E2E Visit 2 - Sinusitis', 'E2E Visit 1 - Influenza']);
    expect(history.some((r) => r.id === other.id)).toBe(false);
  });

  test('requires a diagnosis', async ({ api, data }) => {
    const patient = await data.patient();

    const response = await api.doctor.post(endpoints.medicalRecords, { patientId: patient.id, treatment: 'No diagnosis given' });

    expect(response.ok()).toBe(false);
    expect((await errorBody(response)).success).toBe(false);
  });

  test('rejects a record for an unknown patient', async ({ api }) => {
    const response = await api.doctor.post(endpoints.medicalRecords, { patientId: 2_147_483_000, diagnosis: 'E2E Ghost patient' });
    expect(response.ok()).toBe(false);
  });

  test('returns 404 for a record that does not exist', async ({ api }) => {
    const response = await api.doctor.get(`${endpoints.medicalRecords}/2147483647`);
    expect(response.status()).toBe(404);
  });

  test('reception and laboratory staff cannot write medical records', async ({ api, data }) => {
    const patient = await data.patient();
    const record = await data.medicalRecord({ patientId: patient.id });

    for (const role of ['receptionist', 'laboratory', 'pharmacist', 'accountant'] as const) {
      expect((await api[role].post(endpoints.medicalRecords, { patientId: patient.id, diagnosis: 'E2E blocked' })).status(), `${role} create`).toBe(403);
      expect((await api[role].patch(`${endpoints.medicalRecords}/${record.id}`, { diagnosis: 'E2E tampered' })).status(), `${role} update`).toBe(403);
    }
    expect((await api.doctor.getData<MedicalRecord>(`${endpoints.medicalRecords}/${record.id}`)).diagnosis).toBe(record.diagnosis);
  });

});

test.describe('Medical records screen (doctor, UI)', () => {
  test.use({ storageState: storageStatePath('doctor') });

  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke doctor opens Medical records from the sidebar and sees the patient history', async ({ page, medicalRecordsPage, dashboardPage, data }) => {
    const patient = await data.patient();
    const older = await data.medicalRecord({ patientId: patient.id, diagnosis: 'E2E Visit 1 - Influenza' });
    const newer = await data.medicalRecord({ patientId: patient.id, diagnosis: 'E2E Visit 2 - Recovery', treatment: 'Follow-up in two weeks' });

    await dashboardPage.open();
    const response = await medicalRecordsPage.openFromSidebar();

    expect(response.status()).toBe(200);
    await expect(page).toHaveURL('/medical-records');
    await expect(medicalRecordsPage.table.locator('thead th')).toHaveText(['ID', 'patientId', 'doctorId', 'diagnosis', 'treatment']);
    await medicalRecordsPage.expectRow(older.id, { patientId: patient.id, diagnosis: 'E2E Visit 1 - Influenza' });
    await medicalRecordsPage.expectRow(newer.id, { patientId: patient.id, diagnosis: 'E2E Visit 2 - Recovery', treatment: 'Follow-up in two weeks' });
    const ids = await medicalRecordsPage.rows.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-row-id'))));
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id)); // newest first
  });

  test('doctor records a diagnosis and treatment through the form', async ({ medicalRecordsPage, api, data }) => {
    const patient = await data.patient();
    await medicalRecordsPage.open();

    const result = await medicalRecordsPage.create({ patientId: patient.id, diagnosis: 'E2E Migraine', treatment: 'Rest and hydration' });

    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ patientId: patient.id, diagnosis: 'E2E Migraine', treatment: 'Rest and hydration' });
    const id = result.body.data!.id;
    data.track('medical_records', id);
    await expect(medicalRecordsPage.form).toBeHidden();
    await expect(medicalRecordsPage.notice).toHaveText('Medical record saved successfully');
    await medicalRecordsPage.expectRow(id, { patientId: patient.id, diagnosis: 'E2E Migraine' });
    expect((await api.doctor.getData<MedicalRecord>(`${endpoints.medicalRecords}/${id}`)).treatment).toBe('Rest and hydration');
  });

  test('requires patient, diagnosis and treatment', async ({ page, medicalRecordsPage }) => {
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });
    await medicalRecordsPage.open();

    await medicalRecordsPage.openForm();
    await medicalRecordsPage.submitButton.click();

    for (const field of ['patientId', 'diagnosis', 'treatment'] as const) {
      expect(await medicalRecordsPage.isFieldInvalid(field), field).toBe(true);
    }
    expect(posts).toHaveLength(0);
  });

  test('a receptionist can view the screen but is denied when adding a record', async ({ pageAs, data }) => {
    const patient = await data.patient();
    const page = await pageAs('receptionist');
    const screen = new MedicalRecordsPage(page);
    await screen.open();

    const result = await screen.create({ patientId: patient.id, diagnosis: 'E2E Not allowed', treatment: 'n/a' });

    expect(result.status).toBe(403);
    await expect(screen.formError).toHaveText('You do not have permission to perform this action');
  });
});
