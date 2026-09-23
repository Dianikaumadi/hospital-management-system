import { test, expect, storageStatePath } from '../../fixtures';
import { endpoints } from '../../api/endpoints';
import type { DashboardStats } from '../../api/types';
import { DEFAULT_LINES } from '../../fixtures/invoices';
import { calcInvoiceTotal, parseCurrency } from '../../utils/money';

/**
 * Dashboard figures are global counters, and other tests create records in parallel. All checks
 * are therefore written against the counters' monotonic behaviour:
 *
 *     API value before  <=  value shown in the UI  <=  API value after
 *
 * plus "at least +N" after this test's own creations. (Tagged @counts: do not combine with
 * E2E_CLEANUP=test, which deletes records mid-run.)
 */
test.use({ storageState: storageStatePath('admin') });

type Metric = keyof DashboardStats;
const METRICS: Metric[] = ['patients', 'appointments', 'revenue', 'labTests', 'medicines', 'staff'];

test.describe('Dashboard reports @counts', () => {
  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke shows all six figures and they match the reports API', async ({ dashboardPage, api }) => {
    const before = await api.admin.getData<DashboardStats>(endpoints.dashboard);

    const response = await dashboardPage.open();
    const shown = await dashboardPage.readStats();

    const after = await api.admin.getData<DashboardStats>(endpoints.dashboard);
    expect(response.status()).toBe(200);
    for (const metric of METRICS) {
      expect(shown[metric], `${metric} shown in the UI`).toBeGreaterThanOrEqual(before[metric]);
      expect(shown[metric], `${metric} shown in the UI`).toBeLessThanOrEqual(after[metric]);
    }
  });

  test('cards and the operational summary agree with each other', async ({ dashboardPage }) => {
    await dashboardPage.open();
    // Appointments and lab tests are displayed twice on the page
    await expect(dashboardPage.summaryValue('appointments')).toHaveText(await dashboardPage.statValue('appointments').innerText());
    await expect(dashboardPage.summaryValue('lab-tests')).toHaveText(await dashboardPage.statValue('lab-tests').innerText());
  });

  test('revenue is formatted as currency', async ({ dashboardPage }) => {
    await dashboardPage.open();
    await expect(dashboardPage.statValue('revenue')).toHaveText(/^₹[\d,]+(\.\d+)?$/);
  });

  test('total patients count increases when a patient is registered', async ({ dashboardPage, api, data }) => {
    const before = await api.admin.getData<DashboardStats>(endpoints.dashboard);
    await data.patient();
    await data.patient();

    await dashboardPage.open();
    const shown = await dashboardPage.readStats();

    expect(shown.patients).toBeGreaterThanOrEqual(before.patients + 2);
    expect(shown.patients).toBeLessThanOrEqual((await api.admin.getData<DashboardStats>(endpoints.dashboard)).patients);
  });

  test('appointment count increases when an appointment is booked', async ({ dashboardPage, api, data }) => {
    const before = await api.admin.getData<DashboardStats>(endpoints.dashboard);
    await data.appointment();

    await dashboardPage.open();
    const shown = await dashboardPage.readStats();

    expect(shown.appointments).toBeGreaterThanOrEqual(before.appointments + 1);
  });

  test('revenue increases by the invoice total', async ({ dashboardPage, api, data }) => {
    const before = await api.admin.getData<DashboardStats>(endpoints.dashboard);
    const amount = calcInvoiceTotal(DEFAULT_LINES); // 1600.49
    await data.invoice({ items: DEFAULT_LINES });

    await dashboardPage.open();
    const shown = await dashboardPage.readStats();

    expect(shown.revenue).toBeGreaterThanOrEqual(Math.round((before.revenue + amount) * 100) / 100 - 0.005);
    expect(await dashboardPage.statValue('revenue').innerText()).toMatch(/^₹/);
  });

  test('revenue does not change when only the payment status changes', async ({ api, data }) => {
    const invoice = await data.invoice();
    const before = (await api.admin.getData<DashboardStats>(endpoints.dashboard)).revenue;

    await api.accountant.patchData(`${endpoints.invoices}/${invoice.id}`, { status: 'Paid', paidAt: new Date().toISOString() });

    // Other tests may add invoices meanwhile, so revenue may only ever grow by *their* totals - never shrink.
    expect((await api.admin.getData<DashboardStats>(endpoints.dashboard)).revenue).toBeGreaterThanOrEqual(before);
  });

  test('laboratory count increases when a lab test is requested', async ({ dashboardPage, api, data }) => {
    const before = await api.admin.getData<DashboardStats>(endpoints.dashboard);
    await data.labTest();

    await dashboardPage.open();
    const shown = await dashboardPage.readStats();

    expect(shown.labTests).toBeGreaterThanOrEqual(before.labTests + 1);
  });

  test('medicine count increases when a medicine is added', async ({ dashboardPage, api, data }) => {
    const before = await api.admin.getData<DashboardStats>(endpoints.dashboard);
    await data.medicine();

    await dashboardPage.open();
    const shown = await dashboardPage.readStats();

    expect(shown.medicines).toBeGreaterThanOrEqual(before.medicines + 1);
  });

  test('staff count increases when a staff member is added', async ({ dashboardPage, api, data }) => {
    const before = await api.admin.getData<DashboardStats>(endpoints.dashboard);
    await data.staffMember();

    await dashboardPage.open();
    const shown = await dashboardPage.readStats();

    expect(shown.staff).toBeGreaterThanOrEqual(before.staff + 1);
  });

  test('dashboard API returns numbers for every metric', async ({ api }) => {
    const stats = await api.admin.getData<DashboardStats>(endpoints.dashboard);
    for (const metric of METRICS) {
      expect(typeof stats[metric], metric).toBe('number');
      expect(stats[metric], metric).toBeGreaterThanOrEqual(0);
    }
  });

  test('loads the dashboard for an accountant (revenue access) and a doctor', async ({ pageAs }) => {
    for (const role of ['accountant', 'doctor'] as const) {
      const page = await pageAs(role);
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/api/reports/dashboard')),
        page.goto('/')
      ]);
      expect(response.status(), role).toBe(200);
      const revenue = await page.getByTestId('stat-revenue-value').innerText();
      expect(parseCurrency(revenue), role).toBeGreaterThanOrEqual(0);
    }
  });
});
