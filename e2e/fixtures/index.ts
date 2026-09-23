import { test as base, expect, BrowserContext, Page } from '@playwright/test';
import { ApiClient } from '../api/ApiClient';
import {
  ActivateAccountPage, AppointmentsPage, BillingPage, DashboardPage, DoctorsPage, LaboratoryPage, LoginPage,
  MedicalRecordsPage, PatientsPage, PharmacyPage, RegisterPage, UserManagementPage
} from '../pages';
import { loadSession, Session } from '../utils/session';
import { TestData } from './test-data';
import { ROLE_KEYS, RoleKey, storageStatePath } from './users';

interface WorkerFixtures {
  /** Tokens, users and the shared doctor profile prepared by global-setup. */
  session: Session;
  /** Pre-authenticated API clients, one per role (tokens come from global-setup, no extra logins). */
  api: Record<RoleKey, ApiClient>;
  /** API client without credentials. */
  anonymousApi: ApiClient;
}

interface TestFixtures {
  /** Creates records via the API and tracks them for cleanup. */
  data: TestData;
  /** Opens a page in a fresh browser context that is already logged in as `role`. */
  pageAs: (role: RoleKey) => Promise<Page>;
  diagnostics: void;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  activateAccountPage: ActivateAccountPage;
  userManagementPage: UserManagementPage;
  dashboardPage: DashboardPage;
  patientsPage: PatientsPage;
  doctorsPage: DoctorsPage;
  appointmentsPage: AppointmentsPage;
  medicalRecordsPage: MedicalRecordsPage;
  laboratoryPage: LaboratoryPage;
  pharmacyPage: PharmacyPage;
  billingPage: BillingPage;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  session: [async ({}, use) => use(loadSession()), { scope: 'worker' }],

  api: [async ({ session }, use) => {
    const clients = {} as Record<RoleKey, ApiClient>;
    for (const key of ROLE_KEYS) clients[key] = await ApiClient.create(session.tokens[key]);
    await use(clients);
    await Promise.all(ROLE_KEYS.map((key) => clients[key].dispose()));
  }, { scope: 'worker' }],

  anonymousApi: [async ({}, use) => {
    const client = await ApiClient.create();
    await use(client);
    await client.dispose();
  }, { scope: 'worker' }],

  data: async ({ api, session }, use, testInfo) => {
    const data = new TestData((role) => api[role], session);
    await use(data);
    await data.finish(testInfo); // no-op when the spec already called it from afterEach
  },

  pageAs: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (role) => {
      const context = await browser.newContext({ storageState: storageStatePath(role), locale: 'en-US' });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },

  // Auto fixture: on failure, attach browser console errors and 5xx API responses to the report.
  diagnostics: [async ({ page }, use, testInfo) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
    await use();
    if (testInfo.status !== testInfo.expectedStatus) {
      if (consoleErrors.length) await testInfo.attach('console-errors.txt', { body: consoleErrors.join('\n'), contentType: 'text/plain' });
      if (serverErrors.length) await testInfo.attach('api-5xx-responses.txt', { body: serverErrors.join('\n'), contentType: 'text/plain' });
    }
  }, { auto: true }],

  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  activateAccountPage: async ({ page }, use) => use(new ActivateAccountPage(page)),
  userManagementPage: async ({ page }, use) => use(new UserManagementPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  patientsPage: async ({ page }, use) => use(new PatientsPage(page)),
  doctorsPage: async ({ page }, use) => use(new DoctorsPage(page)),
  appointmentsPage: async ({ page }, use) => use(new AppointmentsPage(page)),
  medicalRecordsPage: async ({ page }, use) => use(new MedicalRecordsPage(page)),
  laboratoryPage: async ({ page }, use) => use(new LaboratoryPage(page)),
  pharmacyPage: async ({ page }, use) => use(new PharmacyPage(page)),
  billingPage: async ({ page }, use) => use(new BillingPage(page))
});

export { expect };
export { storageStatePath, users, ROLE_KEYS } from './users';
export type { RoleKey } from './users';
