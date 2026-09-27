import { test, expect, storageStatePath, users } from '../../fixtures';
import type { RoleKey } from '../../fixtures';
import { DashboardPage } from '../../pages';
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

  test('revenue is formatted as Sri Lankan Rupees', async ({ dashboardPage }) => {
    await dashboardPage.open();
    await expect(dashboardPage.statValue('revenue')).toHaveText(/^LKR [\d,]+\.\d{2}$/);
  });

  test('the reports API declares LKR as the currency', async ({ api }) => {
    const stats = await api.admin.getData<DashboardStats & { currency: string }>(endpoints.dashboard);
    expect(stats.currency).toBe('LKR');
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
    expect(await dashboardPage.statValue('revenue').innerText()).toMatch(/^LKR /);
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

});

/** Cards on each role's own dashboard (GET /reports/overview), in display order. */
const ROLE_CARDS: Record<Exclude<RoleKey, 'admin'>, string[]> = {
  doctor: ['my-appointments-today', 'my-upcoming', 'my-medical-records', 'labs-pending'],
  receptionist: ['appointments-today', 'patients-today', 'patients', 'invoices-unpaid'],
  laboratory: ['labs-requested', 'labs-collected', 'labs-processing', 'labs-completed'],
  pharmacist: ['medicines', 'low-stock', 'out-of-stock', 'stock-value'],
  accountant: ['revenue', 'invoices-pending', 'invoices-partial', 'invoices-paid']
};
type Overview = { role: string; cards: { key: string; value: number; money?: boolean }[]; list: { title: string; items: { id: number; title: string }[] } };

test.describe('Role dashboards', () => {
  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  for (const [roleKey, cards] of Object.entries(ROLE_CARDS) as [Exclude<RoleKey, 'admin'>, string[]][]) {
    const role = users[roleKey].role;

    test(`${role} sees only its own dashboard sections`, async ({ pageAs, api }) => {
      const page = await pageAs(roleKey);
      const dashboard = new DashboardPage(page);
      const response = await dashboard.open();

      expect(new URL(response.url()).pathname).toBe('/api/reports/overview');
      expect(response.status()).toBe(200);
      await expect(dashboard.title).toHaveText(`${role} dashboard`);
      for (const key of cards) await expect(dashboard.card(key), key).toBeVisible();
      // Hospital-wide admin figures are not on role dashboards.
      await expect(page.getByTestId('summary-staff')).toHaveCount(0);
      if (!cards.includes('revenue')) await expect(dashboard.card('revenue')).toHaveCount(0);

      const overview = await api[roleKey].getData<Overview>(endpoints.overview);
      expect(overview.role).toBe(role);
      expect(overview.cards.map((c) => c.key)).toEqual(cards);
    });
  }

  test("a doctor's appointment today appears on their dashboard", async ({ api, data }) => {
    const slot = new Date(Date.now() + 60 * 60 * 1000);
    slot.setUTCMinutes(0, 0, 0);
    const appointment = await data.appointment({ startsAt: slot.toISOString() });
    const window = { from: new Date(Date.now() - 60 * 60 * 1000).toISOString(), to: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() };

    const overview = await api.doctor.getData<Overview>(endpoints.overview, window);

    expect(overview.cards.find((c) => c.key === 'my-appointments-today')!.value).toBeGreaterThanOrEqual(1);
    expect(overview.list.items.map((i) => i.id)).toContain(appointment.id);
  });

  test('an out-of-stock medicine is counted on the pharmacist dashboard', async ({ api, data }) => {
    await data.medicine({ quantity: 0, reorderLevel: 10 });

    const overview = await api.pharmacist.getData<Overview>(endpoints.overview);
    const value = (key: string) => overview.cards.find((c) => c.key === key)!.value;

    expect(value('out-of-stock')).toBeGreaterThanOrEqual(1);
    expect(value('low-stock')).toBeGreaterThanOrEqual(value('out-of-stock') > 0 ? 1 : 0);
  });

  test('money on role dashboards is shown in Sri Lankan Rupees', async ({ pageAs }) => {
    for (const [roleKey, key] of [['accountant', 'revenue'], ['pharmacist', 'stock-value']] as const) {
      const page = await pageAs(roleKey);
      await new DashboardPage(page).open();
      const text = await page.getByTestId(`stat-${key}-value`).innerText();
      expect(text, roleKey).toMatch(/^LKR [\d,]+\.\d{2}$/);
      expect(parseCurrency(text), roleKey).toBeGreaterThanOrEqual(0);
    }
  });

  test('the overview API rejects an invalid date window', async ({ api }) => {
    expect((await api.doctor.get(endpoints.overview, { from: 'not-a-date' })).status()).toBe(422);
  });
});
