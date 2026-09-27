import { test, expect, ROLE_KEYS, users } from '../../fixtures';
import { endpoints } from '../../api/endpoints';
import {
  DASHBOARD_ACCESS, MODULE_KEYS, MODULES, READ_ACCESS, REQUIRED_MODULES, WRITE_ACCESS
} from '../../fixtures/permissions';
import { buildPatient } from '../../fixtures/patients';
import type { Page } from '@playwright/test';
import {
  AppointmentsPage, BillingPage, DashboardPage, DoctorsPage, LaboratoryPage, MedicalRecordsPage, PatientsPage, PharmacyPage,
  UserManagementPage
} from '../../pages';
import type { ModuleListPage } from '../../pages/ModuleListPage';

/** An id that cannot exist. Authorisation runs before the lookup, so 403 vs 404 reveals the decision. */
const MISSING_ID = 2_147_483_647;

const screens: Record<string, (page: Page) => ModuleListPage<object>> = {
  patients: (p) => new PatientsPage(p),
  doctors: (p) => new DoctorsPage(p),
  appointments: (p) => new AppointmentsPage(p),
  medicalRecords: (p) => new MedicalRecordsPage(p),
  laboratory: (p) => new LaboratoryPage(p),
  pharmacy: (p) => new PharmacyPage(p),
  billing: (p) => new BillingPage(p)
};

test.describe('RBAC - modules each role must be able to use (UI)', () => {
  for (const roleKey of ROLE_KEYS) {
    const user = users[roleKey];
    const uiModules = REQUIRED_MODULES[roleKey].filter((m) => MODULES[m].nav);

    test(`@smoke ${user.role} can open ${uiModules.map((m) => MODULES[m].label).join(', ')} from the sidebar`, async ({ pageAs }) => {
      const page = await pageAs(roleKey);
      await new DashboardPage(page).open();

      for (const key of uiModules) {
        const screen = screens[key](page);
        const response = await screen.openFromSidebar();

        expect(response.status(), `${user.role} listing ${MODULES[key].label}`).toBe(200);
        await expect(page).toHaveURL(screen.path);
        await expect(screen.heading).toHaveText(MODULES[key].title!);
        await expect(screen.addButton).toBeVisible();
      }
    });
  }
});

test.describe('RBAC - API access matrix @api', () => {
  for (const roleKey of ROLE_KEYS) {
    const user = users[roleKey];

    for (const moduleKey of MODULE_KEYS) {
      const module = MODULES[moduleKey];
      const canRead = READ_ACCESS[moduleKey].includes(roleKey);
      const canWrite = WRITE_ACCESS[moduleKey].includes(roleKey);

      test(`${user.role} ${canRead ? 'can' : 'cannot'} read and ${canWrite ? 'can' : 'cannot'} write ${module.label}`, async ({ api }) => {
        // Read: list and single-record lookups follow the same rule (404 on a missing id means "authorised").
        const read = await api[roleKey].get(module.endpoint, { limit: 1 });
        expect(read.status(), `${user.role} GET ${module.endpoint}`).toBe(canRead ? 200 : 403);
        const readOne = await api[roleKey].get(`${module.endpoint}/${MISSING_ID}`);
        expect(readOne.status(), `${user.role} GET ${module.endpoint}/:id`).toBe(canRead ? 404 : 403);

        // Write: PATCH on a non-existent row -> 404 means "authorised", 403 means "denied".
        const write = await api[roleKey].patch(`${module.endpoint}/${MISSING_ID}`, {});
        expect(write.status(), `${user.role} PATCH ${module.endpoint}`).toBe(canWrite ? 404 : 403);
        if (!canWrite) {
          expect((await write.json()).message).toBe('You do not have permission to perform this action');
        }
      });
    }

    test(`${user.role} ${DASHBOARD_ACCESS.includes(roleKey) ? 'can' : 'cannot'} read dashboard reports`, async ({ api }) => {
      const response = await api[roleKey].get(endpoints.dashboard);
      expect(response.status()).toBe(DASHBOARD_ACCESS.includes(roleKey) ? 200 : 403);
    });
  }
});

test.describe('RBAC - requirement checks', () => {
  test('Admin can access all modules (UI screens + API)', async ({ pageAs, api }) => {
    const page = await pageAs('admin');
    await new DashboardPage(page).open();
    for (const key of Object.keys(screens)) {
      const screen = screens[key](page);
      expect((await screen.openFromSidebar()).status()).toBe(200);
    }
    for (const key of MODULE_KEYS) {
      expect((await api.admin.get(MODULES[key].endpoint, { limit: 1 })).status(), key).toBe(200);
      expect((await api.admin.patch(`${MODULES[key].endpoint}/${MISSING_ID}`, {})).status(), `${key} write`).toBe(404);
    }
    expect((await api.admin.get(endpoints.dashboard)).status()).toBe(200);
  });

  test('Doctor can read and create appointments and medical records', async ({ api, data }) => {
    const patient = await data.patient();
    const appointment = await data.appointment({ patientId: patient.id }, 'doctor');
    const record = await data.medicalRecord({ patientId: patient.id }, 'doctor');

    expect((await api.doctor.get(`${endpoints.appointments}/${appointment.id}`)).status()).toBe(200);
    expect((await api.doctor.get(`${endpoints.medicalRecords}/${record.id}`)).status()).toBe(200);
  });

  test('Receptionist can read and create patients and appointments', async ({ api, data }) => {
    const patient = await data.patient({}, 'receptionist');
    const appointment = await data.appointment({ patientId: patient.id }, 'receptionist');

    expect((await api.receptionist.get(`${endpoints.patients}/${patient.id}`)).status()).toBe(200);
    expect((await api.receptionist.get(`${endpoints.appointments}/${appointment.id}`)).status()).toBe(200);
  });

  test('Laboratory staff can work with lab requests but cannot register patients', async ({ api, data }) => {
    const patient = await data.patient();
    const lab = await data.labTest({ patientId: patient.id });
    const updated = await api.laboratory.patch(`${endpoints.labTests}/${lab.id}`, { status: 'Collected' });
    expect(updated.status()).toBe(200);

    const denied = await api.laboratory.post(endpoints.patients, buildPatient());
    expect(denied.status()).toBe(403);
  });

  test('Pharmacist can manage medicines but cannot touch billing', async ({ api, data }) => {
    const medicine = await data.medicine();
    expect((await api.pharmacist.patch(`${endpoints.medicines}/${medicine.id}`, { quantity: 5 })).status()).toBe(200);
    expect((await api.pharmacist.post(endpoints.invoices, {})).status()).toBe(403);
  });

  test('Accountant can manage invoices and read dashboard revenue but cannot edit medicines', async ({ api, data }) => {
    const invoice = await data.invoice();
    expect((await api.accountant.patch(`${endpoints.invoices}/${invoice.id}`, { status: 'Paid' })).status()).toBe(200);
    expect((await api.accountant.get(endpoints.dashboard)).status()).toBe(200);
    expect((await api.accountant.patch(`${endpoints.medicines}/${MISSING_ID}`, {})).status()).toBe(403);
  });
});

test.describe('RBAC - user management is Admin-only', () => {
  // GET /users is unlike the CRUD modules above (where reads are open to any authenticated role),
  // so it is not part of MODULES/WRITE_ACCESS - it gets its own small matrix here.
  for (const roleKey of ROLE_KEYS) {
    const user = users[roleKey];
    const isAdmin = roleKey === 'admin';

    test(`${user.role} ${isAdmin ? 'can' : 'cannot'} list users`, async ({ api }) => {
      const response = await api[roleKey].get(endpoints.users);
      expect(response.status()).toBe(isAdmin ? 200 : 403);
    });
  }

  test('non-admins do not see "User management" in the sidebar, and visiting /users redirects them to the dashboard', async ({ pageAs }) => {
    for (const roleKey of ROLE_KEYS.filter((k) => k !== 'admin')) {
      const page = await pageAs(roleKey);
      await new DashboardPage(page).open();
      await expect(page.getByTestId('nav-user-management'), users[roleKey].role).toHaveCount(0);

      await page.goto('/users');
      await expect(page).toHaveURL('/');
    }
  });

  test('@smoke Admin sees "User management" in the sidebar and can open it', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await new DashboardPage(page).open();

    const response = await new UserManagementPage(page).openFromSidebar();

    expect(response.status()).toBe(200);
    await expect(page).toHaveURL('/users');
  });
});

test.describe('RBAC - each role only sees what it can use (UI)', () => {
  for (const roleKey of ROLE_KEYS) {
    const user = users[roleKey];

    test(`${user.role} sees exactly the modules it can read in the sidebar`, async ({ pageAs }) => {
      const page = await pageAs(roleKey);
      await new DashboardPage(page).open();
      await expect(page.getByTestId('nav-dashboard')).toBeVisible();

      for (const key of MODULE_KEYS.filter((m) => MODULES[m].nav)) {
        const expected = READ_ACCESS[key].includes(roleKey) ? 1 : 0;
        await expect(page.getByTestId(`nav-${MODULES[key].nav}`), `${user.role} -> ${MODULES[key].label}`).toHaveCount(expected);
      }
    });
  }

  test('opening a hidden screen by URL redirects to the dashboard', async ({ pageAs }) => {
    const cases = [['pharmacist', '/patients'], ['receptionist', '/pharmacy'], ['laboratory', '/billing'], ['accountant', '/medical-records']] as const;
    for (const [roleKey, path] of cases) {
      const page = await pageAs(roleKey);
      await page.goto(path);
      await expect(page, `${users[roleKey].role} -> ${path}`).toHaveURL('/');
      await expect(page.getByTestId('dashboard-title')).toBeVisible();
    }
  });

  test('view-only screens list records but offer no "Add new" button', async ({ pageAs }) => {
    const cases = [['doctor', 'doctors'], ['laboratory', 'patients'], ['accountant', 'patients']] as const;
    for (const [roleKey, key] of cases) {
      expect(WRITE_ACCESS[key]).not.toContain(roleKey); // guard: the case really is view-only
      const page = await pageAs(roleKey);
      const screen = screens[key](page);

      expect((await screen.open()).status(), `${users[roleKey].role} listing ${key}`).toBe(200);
      await expect(screen.addButton).toHaveCount(0);
      await expect(page.getByTestId('view-only-badge')).toHaveText('View only');
    }
  });
});
