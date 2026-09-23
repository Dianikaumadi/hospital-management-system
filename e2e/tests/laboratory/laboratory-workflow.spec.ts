import { test, expect, storageStatePath } from '../../fixtures';
import { endpoints } from '../../api/endpoints';
import type { LabStatus, LabTest } from '../../api/types';
import { buildLabTest, LAB_WORKFLOW } from '../../fixtures/lab-tests';

const RESULT_TEXT = 'Hemoglobin 13.5 g/dL; WBC 6.2 x10^9/L; Platelets 250 x10^9/L - all within normal range';
const REPORT_URL = 'https://reports.hms-e2e.test/cbc-report-001.pdf';

test.describe('Laboratory - requests (doctor, UI)', () => {
  test.use({ storageState: storageStatePath('doctor') });

  test.beforeEach(async ({ laboratoryPage }) => {
    await laboratoryPage.open();
  });

  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke creates a laboratory request that starts as Requested', async ({ laboratoryPage, api, data }) => {
    const patient = await data.patient();
    const input = buildLabTest(patient.id);

    const result = await laboratoryPage.create({ patientId: patient.id, testName: input.testName });

    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ patientId: patient.id, testName: input.testName, status: 'Requested' });
    const id = result.body.data!.id;
    data.track('lab_tests', id);

    await expect(laboratoryPage.form).toBeHidden();
    await expect(laboratoryPage.notice).toHaveText('Laboratory test saved successfully');
    await laboratoryPage.expectRow(id, { patientId: patient.id, testName: input.testName, status: 'Requested' });

    const saved = await api.doctor.getData<LabTest>(`${endpoints.labTests}/${id}`);
    expect(saved).toMatchObject({ status: 'Requested', result: null, reportUrl: null });
  });

  test('requires patient and test name', async ({ page, laboratoryPage }) => {
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

    await laboratoryPage.openForm();
    await laboratoryPage.submitButton.click();

    expect(await laboratoryPage.isFieldInvalid('patientId')).toBe(true);
    expect(await laboratoryPage.isFieldInvalid('testName')).toBe(true);
    expect(posts).toHaveLength(0);
  });

  test('rejects a request for an unknown patient', async ({ laboratoryPage }) => {
    const result = await laboratoryPage.create({ patientId: 2_147_483_000, testName: 'E2E Ghost test' });

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(laboratoryPage.formError).toBeVisible();
  });
});

test.describe('Laboratory - processing (laboratory staff)', () => {
  test.use({ storageState: storageStatePath('laboratory') });

  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('lab staff sees the doctor\'s request in the laboratory list', async ({ laboratoryPage, data }) => {
    const lab = await data.labTest(); // created by the doctor via API

    await laboratoryPage.open();

    await laboratoryPage.expectRow(lab.id, { testName: lab.testName, status: 'Requested', patientId: lab.patientId });
  });

  test('@smoke moves a request through Requested -> Collected -> Processing -> Completed', async ({ laboratoryPage, api, data }) => {
    const lab = await data.labTest();
    const url = `${endpoints.labTests}/${lab.id}`;
    const seen: LabStatus[] = [lab.status];

    for (const status of LAB_WORKFLOW.slice(1)) {
      const response = await api.laboratory.patch(url, { status });

      expect(response.status(), `-> ${status}`).toBe(200);
      expect((await response.json()).data.status).toBe(status);
      expect((await api.laboratory.getData<LabTest>(url)).status).toBe(status);

      await laboratoryPage.open();
      await laboratoryPage.expectRow(lab.id, { status });
      seen.push(status);
    }

    expect(seen).toEqual(LAB_WORKFLOW);
  });

  test('enters results and the completed report can be verified', async ({ laboratoryPage, api, data }) => {
    const lab = await data.labTest();
    const url = `${endpoints.labTests}/${lab.id}`;
    await api.laboratory.patchData<LabTest>(url, { status: 'Processing' });

    // Not completed yet: no result on record
    expect(await api.laboratory.getData<LabTest>(url)).toMatchObject({ result: null, reportUrl: null });

    const completed = await api.laboratory.patchData<LabTest>(url, { status: 'Completed', result: RESULT_TEXT, reportUrl: REPORT_URL });

    expect(completed).toMatchObject({ status: 'Completed', result: RESULT_TEXT, reportUrl: REPORT_URL });
    const report = await api.doctor.getData<LabTest>(url); // the ordering doctor can read it back
    expect(report).toMatchObject({
      id: lab.id, patientId: lab.patientId, testName: lab.testName, status: 'Completed', result: RESULT_TEXT, reportUrl: REPORT_URL
    });
    expect(report.requestedBy).toBe(lab.requestedBy);

    await laboratoryPage.open();
    await laboratoryPage.expectRow(lab.id, { status: 'Completed' });
  });

  test('rejects an unknown status', async ({ api, data }) => {
    const lab = await data.labTest();
    const response = await api.laboratory.patch(`${endpoints.labTests}/${lab.id}`, { status: 'Lost' });
    expect(response.ok()).toBe(false);
    expect((await api.laboratory.getData<LabTest>(`${endpoints.labTests}/${lab.id}`)).status).toBe('Requested');
  });

  test('pharmacists and accountants cannot update lab tests', async ({ api, data }) => {
    const lab = await data.labTest();
    for (const role of ['pharmacist', 'accountant', 'receptionist'] as const) {
      expect((await api[role].patch(`${endpoints.labTests}/${lab.id}`, { status: 'Collected' })).status(), role).toBe(403);
    }
    expect((await api.laboratory.getData<LabTest>(`${endpoints.labTests}/${lab.id}`)).status).toBe('Requested');
  });
});
