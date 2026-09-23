import path from 'path';
import { test, expect, storageStatePath } from '../../fixtures';
import { errorBody } from '../../api/ApiClient';
import { endpoints, patientDocuments } from '../../api/endpoints';
import type { Patient } from '../../api/types';
import { env } from '../../config/env';
import { FIXTURE_FILES_DIR } from '../../config/paths';
import { buildPatient, patientFormFields } from '../../fixtures/patients';

test.use({ storageState: storageStatePath('receptionist') });

test.describe('Patient management - UI', () => {
  test.beforeEach(async ({ patientsPage }) => {
    await patientsPage.open();
  });

  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke creates a patient through the form', async ({ patientsPage, api, data }) => {
    const input = buildPatient();

    const result = await patientsPage.create(patientFormFields(input));

    // API response
    expect(result.status).toBe(201);
    expect(result.body.success).toBe(true);
    expect(result.body.data).toMatchObject({
      medicalRecordNumber: input.medicalRecordNumber, firstName: input.firstName, lastName: input.lastName,
      dateOfBirth: input.dateOfBirth, gender: input.gender, phone: input.phone, documents: []
    });
    const id = result.body.data!.id;
    data.track('patients', id);

    // UI feedback: modal closes, success message, row appears
    await expect(patientsPage.form).toBeHidden();
    await expect(patientsPage.notice).toHaveText('Patient saved successfully');
    await patientsPage.expectRow(id, {
      firstName: input.firstName, lastName: input.lastName, phone: input.phone, gender: input.gender
    });

    // Persisted
    const saved = await api.receptionist.getData<Patient>(`${endpoints.patients}/${id}`);
    expect(saved).toMatchObject(patientFormFields(input));
  });

  test('shows all form fields as required and does not submit an empty form', async ({ page, patientsPage }) => {
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

    await patientsPage.openForm();
    const fields = Object.keys(patientFormFields(buildPatient())) as (keyof ReturnType<typeof patientFormFields>)[];
    for (const name of fields) {
      await expect(patientsPage.field(name), `${name} is required`).toHaveAttribute('required', '');
      await expect(patientsPage.field(name)).toHaveAttribute('placeholder', name);
    }

    await patientsPage.submitButton.click();

    for (const name of fields) expect(await patientsPage.isFieldInvalid(name), name).toBe(true);
    await expect(patientsPage.form).toBeVisible();
    expect(posts).toHaveLength(0);
  });

  test('submits only when the last missing field is filled', async ({ patientsPage, data }) => {
    const input = patientFormFields(buildPatient());
    await patientsPage.openForm();
    const { phone, ...rest } = input;
    await patientsPage.fillForm(rest as typeof input);

    await patientsPage.submitButton.click();

    expect(await patientsPage.isFieldInvalid('phone')).toBe(true);
    await expect(patientsPage.form).toBeVisible();

    await patientsPage.field('phone').fill(phone);
    const result = await patientsPage.submitForm();
    expect(result.status).toBe(201);
    data.track('patients', result.body.data!.id);
    await expect(patientsPage.notice).toBeVisible();
  });

  test('shows an error and keeps the form open when the server rejects the data', async ({ patientsPage, api }) => {
    const input = buildPatient({ gender: 'NotAGender' as never });

    const result = await patientsPage.create(patientFormFields(input));

    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body.success).toBe(false);
    await expect(patientsPage.formError).toBeVisible();
    await expect(patientsPage.formError).not.toBeEmpty();
    await expect(patientsPage.form).toBeVisible();
    await expect(patientsPage.notice).toHaveCount(0);

    // Nothing was created
    expect(await api.receptionist.list<Patient>(endpoints.patients, { search: input.medicalRecordNumber })).toHaveLength(0);
  });

  test('rejects a duplicate medical record number', async ({ patientsPage, api, data }) => {
    const existing = await data.patient();

    const result = await patientsPage.create(patientFormFields(buildPatient({ medicalRecordNumber: existing.medicalRecordNumber })));

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(patientsPage.formError).toBeVisible();
    const matches = await api.receptionist.list<Patient>(endpoints.patients, { search: existing.medicalRecordNumber });
    expect(matches).toHaveLength(1);
  });

  test('lists patients with the expected columns', async ({ patientsPage, data }) => {
    const [a, b, c] = [await data.patient(), await data.patient(), await data.patient()];

    await patientsPage.refresh();

    await expect(patientsPage.table.locator('thead th')).toHaveText(['ID', 'firstName', 'lastName', 'phone', 'gender']);
    for (const patient of [a, b, c]) {
      await patientsPage.expectRow(patient.id, {
        id: `#${patient.id}`, firstName: patient.firstName, lastName: patient.lastName, phone: patient.phone, gender: patient.gender
      });
    }
    // newest first
    const ids = await patientsPage.rows.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-row-id'))));
    expect(ids.indexOf(c.id)).toBeLessThan(ids.indexOf(a.id));
  });

  test('@smoke searches patients by medical record number', async ({ patientsPage, data }) => {
    const target = await data.patient();
    const other = await data.patient();
    await patientsPage.refresh();
    await expect(patientsPage.rowById(other.id)).toBeVisible();

    const response = await patientsPage.search(target.medicalRecordNumber);

    expect(response.url()).toContain(`search=${encodeURIComponent(target.medicalRecordNumber)}`);
    expect((await response.json()).data).toHaveLength(1);
    await expect(patientsPage.rows).toHaveCount(1);
    await expect(patientsPage.rowById(target.id)).toBeVisible();
    await expect(patientsPage.rowById(other.id)).toHaveCount(0);
  });

  test('search is case-insensitive and shows an empty state for no match', async ({ patientsPage, data }) => {
    const target = await data.patient();
    await patientsPage.refresh();

    await patientsPage.search(target.medicalRecordNumber.toUpperCase());
    await expect(patientsPage.rowById(target.id)).toBeVisible();

    await patientsPage.search('e2e-no-such-patient');
    await expect(patientsPage.rows).toHaveCount(0);
    await expect(patientsPage.emptyState).toHaveText('No records found');

    await patientsPage.search('');
    await expect(patientsPage.rowById(target.id)).toBeVisible(); // clearing the search restores the list
  });
});

test.describe('Patient management - API @api', () => {
  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('verifies the full patient record after creation', async ({ api, data }) => {
    const input = buildPatient({ bloodGroup: 'AB-', address: '221B Baker Street', emergencyContact: 'Mary Watson' });
    const created = await data.patient(input);

    const saved = await api.receptionist.getData<Patient>(`${endpoints.patients}/${created.id}`);

    expect(saved).toMatchObject({ ...input, id: created.id, documents: [] });
    expect(saved.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(saved.createdAt).getTime()).not.toBeNaN();
  });

  test('updates a patient and returns the new values', async ({ api, data, patientsPage }) => {
    const patient = await data.patient();
    const changes = { lastName: 'Updated', phone: '+91 91111 22222', address: '9 New Street', bloodGroup: 'B+' };

    const response = await api.receptionist.patch(`${endpoints.patients}/${patient.id}`, changes);

    expect(response.status()).toBe(200);
    expect((await response.json()).data).toMatchObject({ ...changes, id: patient.id, firstName: patient.firstName });
    expect(await api.receptionist.getData<Patient>(`${endpoints.patients}/${patient.id}`)).toMatchObject(changes);

    // ...and the UI shows it
    await patientsPage.open();
    await patientsPage.expectRow(patient.id, { lastName: 'Updated', phone: changes.phone });
  });

  test('returns 404 when updating or reading a patient that does not exist', async ({ api }) => {
    const update = await api.receptionist.patch(`${endpoints.patients}/2147483647`, { lastName: 'x' });
    expect(update.status()).toBe(404);
    expect((await errorBody(update)).message).toBe('Resource not found');
    expect((await api.receptionist.get(`${endpoints.patients}/2147483647`)).status()).toBe(404);
  });

  test('rejects a patient without the required fields', async ({ api }) => {
    const mrn = buildPatient().medicalRecordNumber;
    const response = await api.receptionist.post(endpoints.patients, { medicalRecordNumber: mrn, firstName: 'Incomplete' });
    expect(response.ok()).toBe(false);
    expect(await api.receptionist.list<Patient>(endpoints.patients, { search: mrn })).toHaveLength(0);
  });

  test.describe('documents', () => {
    const sample = path.join(FIXTURE_FILES_DIR, 'sample-report.txt');

    test('@smoke uploads a document and attaches it to the patient', async ({ api, data }) => {
      const patient = await data.patient();

      const response = await api.receptionist.upload(patientDocuments(patient.id), { field: 'document', filePath: sample });

      expect(response.status()).toBe(201);
      const uploaded = (await response.json()).data;
      expect(uploaded).toMatchObject({ name: 'sample-report.txt' });
      expect(uploaded.url).toMatch(/^\/uploads\/\d+-sample-report\.txt$/);
      expect(new Date(uploaded.uploadedAt).getTime()).not.toBeNaN();

      const saved = await api.receptionist.getData<Patient>(`${endpoints.patients}/${patient.id}`);
      expect(saved.documents).toEqual([uploaded]);

      // The stored file is actually downloadable
      const download = await api.receptionist.ctx.get(`${env.apiUrl}${uploaded.url}`);
      expect(download.status()).toBe(200);
      expect(await download.text()).toContain('E2E patient document');
    });

    test('appends further uploads instead of replacing earlier ones', async ({ api, data }) => {
      const patient = await data.patient();
      await api.receptionist.upload(patientDocuments(patient.id), { field: 'document', filePath: sample });
      await api.doctor.upload(patientDocuments(patient.id), { field: 'document', filePath: sample });

      const saved = await api.receptionist.getData<Patient>(`${endpoints.patients}/${patient.id}`);
      expect(saved.documents).toHaveLength(2);
      expect(new Set(saved.documents.map((d) => d.url)).size).toBe(2);
    });

    test('requires a file', async ({ api, data }) => {
      const patient = await data.patient();
      const response = await api.receptionist.upload(patientDocuments(patient.id));
      expect(response.status()).toBe(422);
      expect((await errorBody(response)).message).toBe('A document file is required');
    });

    test('returns 404 for an unknown patient', async ({ api }) => {
      const response = await api.receptionist.upload(patientDocuments(2_147_483_647), { field: 'document', filePath: sample });
      expect(response.status()).toBe(404);
    });

    test('is not allowed for roles without patient access', async ({ api, data }) => {
      const patient = await data.patient();
      const response = await api.pharmacist.upload(patientDocuments(patient.id), { field: 'document', filePath: sample });
      expect(response.status()).toBe(403);
      expect((await api.receptionist.getData<Patient>(`${endpoints.patients}/${patient.id}`)).documents).toHaveLength(0);
    });

    test('rejects files larger than 5 MB', async ({ api, data }) => {
      const patient = await data.patient();
      const big = await api.receptionist.ctx.post(patientDocuments(patient.id), {
        multipart: { document: { name: 'too-big.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(5 * 1024 * 1024 + 1024) } }
      });
      expect(big.ok()).toBe(false);
      expect((await api.receptionist.getData<Patient>(`${endpoints.patients}/${patient.id}`)).documents).toHaveLength(0);
    });
  });
});
