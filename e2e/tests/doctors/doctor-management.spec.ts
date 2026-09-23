import { test, expect, storageStatePath } from '../../fixtures';
import { endpoints } from '../../api/endpoints';
import type { Doctor } from '../../api/types';
import { buildDoctor, DEPARTMENTS, SPECIALIZATIONS } from '../../fixtures/doctors';
import { uid } from '../../utils/random';

test.use({ storageState: storageStatePath('admin') });

test.describe('Doctor management - UI', () => {
  test.beforeEach(async ({ doctorsPage }) => {
    await doctorsPage.open();
  });

  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke creates a doctor linked to a doctor account', async ({ doctorsPage, api, data }) => {
    const account = await data.user('Doctor');
    const input = buildDoctor(account.id, { specialization: SPECIALIZATIONS[0], consultationFee: '750' });

    const result = await doctorsPage.create(input);

    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({
      userId: account.id, specialization: input.specialization, department: input.department,
      licenseNumber: input.licenseNumber, consultationFee: '750.00'
    });
    const id = result.body.data!.id;
    data.track('doctors', id);

    await expect(doctorsPage.form).toBeHidden();
    await expect(doctorsPage.notice).toHaveText('Doctor saved successfully');
    await doctorsPage.expectRow(id, {
      specialization: input.specialization, department: input.department, licenseNumber: input.licenseNumber
    });

    const saved = await api.admin.getData<Doctor>(`${endpoints.doctors}/${id}`);
    expect(saved).toMatchObject({ userId: account.id, department: input.department });
  });

  test('requires every field', async ({ page, doctorsPage }) => {
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

    await doctorsPage.openForm();
    await doctorsPage.submitButton.click();

    for (const field of ['userId', 'specialization', 'department', 'licenseNumber', 'consultationFee'] as const) {
      expect(await doctorsPage.isFieldInvalid(field), field).toBe(true);
    }
    expect(posts).toHaveLength(0);
  });

  test('rejects a doctor whose account does not exist', async ({ doctorsPage, api }) => {
    const input = buildDoctor(2_147_483_000);

    const result = await doctorsPage.create(input);

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(doctorsPage.formError).toBeVisible();
    expect(await api.admin.list<Doctor>(endpoints.doctors, { search: input.department })).toHaveLength(0);
  });

  test('rejects a duplicate licence number', async ({ doctorsPage, data }) => {
    const existing = await data.doctor();
    const account = await data.user('Doctor');

    const result = await doctorsPage.create(buildDoctor(account.id, { licenseNumber: existing.licenseNumber }));

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(doctorsPage.formError).toBeVisible();
  });

  test('rejects a second doctor profile for the same account', async ({ doctorsPage, data }) => {
    const existing = await data.doctor();

    const result = await doctorsPage.create(buildDoctor(existing.userId));

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(doctorsPage.formError).toBeVisible();
  });

  test('verifies the doctor list and its columns', async ({ doctorsPage, data }) => {
    const doctors = [await data.doctor(), await data.doctor()];

    await doctorsPage.refresh();

    await expect(doctorsPage.table.locator('thead th')).toHaveText(['ID', 'specialization', 'department', 'licenseNumber']);
    for (const doctor of doctors) {
      await doctorsPage.expectRow(doctor.id, {
        id: `#${doctor.id}`, specialization: doctor.specialization, department: doctor.department, licenseNumber: doctor.licenseNumber
      });
    }
  });

  test('searches doctors by department', async ({ doctorsPage, data }) => {
    const target = await data.doctor();
    const other = await data.doctor();
    await doctorsPage.refresh();

    await doctorsPage.search(target.department);

    await expect(doctorsPage.rows).toHaveCount(1);
    await expect(doctorsPage.rowById(target.id)).toBeVisible();
    await expect(doctorsPage.rowById(other.id)).toHaveCount(0);
  });
});

test.describe('Doctor management - updates @api', () => {
  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('assigns a department to a doctor', async ({ api, data, doctorsPage }) => {
    const doctor = await data.doctor({ department: 'e2e-unassigned' });
    const department = `e2e-${DEPARTMENTS[0].toLowerCase()}-${uid(5)}`; // lowercase: department search is an exact, lowercased match

    const response = await api.admin.patch(`${endpoints.doctors}/${doctor.id}`, { department });

    expect(response.status()).toBe(200);
    expect((await response.json()).data).toMatchObject({ id: doctor.id, department });
    expect(await api.admin.list<Doctor>(endpoints.doctors, { search: department })).toEqual([expect.objectContaining({ id: doctor.id })]);
    expect(await api.admin.list<Doctor>(endpoints.doctors, { search: 'e2e-unassigned' })).not.toContainEqual(expect.objectContaining({ id: doctor.id }));

    await doctorsPage.open();
    await doctorsPage.expectRow(doctor.id, { department });
  });

  test('sets the specialization of a doctor', async ({ api, data, doctorsPage }) => {
    const doctor = await data.doctor({ specialization: 'General Medicine' });

    const response = await api.admin.patch(`${endpoints.doctors}/${doctor.id}`, { specialization: SPECIALIZATIONS[1] });

    expect(response.status()).toBe(200);
    expect(await api.admin.getData<Doctor>(`${endpoints.doctors}/${doctor.id}`)).toMatchObject({
      specialization: SPECIALIZATIONS[1], licenseNumber: doctor.licenseNumber, userId: doctor.userId // untouched fields stay
    });
    await doctorsPage.open();
    await doctorsPage.expectRow(doctor.id, { specialization: SPECIALIZATIONS[1] });
  });

  test('updates department, specialization and fee in one request', async ({ api, data }) => {
    const doctor = await data.doctor();

    const updated = await api.admin.patchData<Doctor>(`${endpoints.doctors}/${doctor.id}`, {
      department: 'e2e-combined', specialization: 'Pediatric Cardiology', consultationFee: '900'
    });

    expect(updated).toMatchObject({ department: 'e2e-combined', specialization: 'Pediatric Cardiology' });
    expect(Number(updated.consultationFee)).toBe(900); // PATCH echoes the input as sent ("900")
    expect((await api.admin.getData<Doctor>(`${endpoints.doctors}/${doctor.id}`)).consultationFee).toBe('900.00'); // stored as DECIMAL(10,2)
  });

  test('a receptionist can update doctors too, a pharmacist cannot', async ({ api, data }) => {
    const doctor = await data.doctor();
    expect((await api.receptionist.patch(`${endpoints.doctors}/${doctor.id}`, { department: 'e2e-by-reception' })).status()).toBe(200);
    expect((await api.pharmacist.patch(`${endpoints.doctors}/${doctor.id}`, { department: 'e2e-blocked' })).status()).toBe(403);
    expect((await api.admin.getData<Doctor>(`${endpoints.doctors}/${doctor.id}`)).department).toBe('e2e-by-reception');
  });

  test('doctor appears in the API list with correct types', async ({ api, data }) => {
    const doctor = await data.doctor();
    const listed = (await api.admin.list<Doctor>(endpoints.doctors)).find((d) => d.id === doctor.id);
    expect(listed).toBeDefined();
    expect(typeof listed!.userId).toBe('number');
    expect(listed!.consultationFee).toMatch(/^\d+\.\d{2}$/);
  });
});
