import { test, expect, users } from '../../fixtures';
import { endpoints } from '../../api/endpoints';
import { LoginPage } from '../../pages';
import { ApiClient } from '../../api/ApiClient';
import { env } from '../../config/env';

const PROTECTED_PATHS = ['/', '/patients', '/appointments', '/doctors', '/laboratory', '/pharmacy', '/billing'];

test.describe('Protected routes - UI', () => {
  for (const path of PROTECTED_PATHS) {
    test(`@smoke ${path} redirects to /login without a session`, async ({ page }) => {
      const dataRequests: string[] = [];
      page.on('request', (r) => { if (/\/api\/(?!auth)/.test(r.url())) dataRequests.push(r.url()); });

      await page.goto(path);

      await expect(page).toHaveURL(/\/login$/);
      await expect(new LoginPage(page).form).toBeVisible();
      expect(dataRequests, 'no data must be requested for an anonymous visitor').toHaveLength(0);
    });
  }

  test('unknown routes redirect anonymous visitors to /login', async ({ page }) => {
    await page.goto('/this/route/does-not-exist');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('an already signed-in user visiting /login is sent to the dashboard', async ({ pageAs }) => {
    const page = await pageAs('admin');
    await page.goto('/login');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('dashboard-title')).toBeVisible();
  });

  test('clearing the session storage blocks the next navigation', async ({ pageAs }) => {
    const page = await pageAs('doctor');
    await page.goto('/appointments');
    await expect(page.getByTestId('module-title')).toHaveText('Appointments');

    await page.evaluate(() => localStorage.clear());
    await page.goto('/appointments');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('an invalid or expired token ends the session and sends the user back to /login', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [{
          origin: env.baseUrl,
          localStorage: [
            { name: 'hms_token', value: 'expired.or.invalid' },
            { name: 'hms_user', value: JSON.stringify({ id: 1, firstName: 'E2E', lastName: 'Stale', email: 'x@y.z', role: 'Admin' }) }
          ]
        }]
      }
    });
    const page = await context.newPage();
    await page.goto('/patients');

    await expect(page).toHaveURL(/\/login$/);
    await expect(new LoginPage(page).form).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('hms_token'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('hms_user'))).toBeNull();
    await context.close();
  });
});

test.describe('Protected routes - API @api', () => {
  const PROTECTED_ENDPOINTS = [
    endpoints.patients, endpoints.doctors, endpoints.appointments, endpoints.medicalRecords, endpoints.labTests,
    endpoints.medicines, endpoints.invoices, endpoints.staff, endpoints.dashboard, endpoints.me
  ];

  for (const endpoint of PROTECTED_ENDPOINTS) {
    test(`GET /api/${endpoint} without a token returns 401`, async ({ anonymousApi }) => {
      const response = await anonymousApi.get(endpoint);
      expect(response.status()).toBe(401);
      expect(await response.json()).toMatchObject({ success: false, message: 'Authentication token is required' });
    });
  }

  test('POST without a token returns 401 and creates nothing', async ({ anonymousApi }) => {
    const response = await anonymousApi.post(endpoints.patients, { firstName: 'No', lastName: 'Auth' });
    expect(response.status()).toBe(401);
  });

  test('a garbage token is rejected (401)', async () => {
    const client = await ApiClient.create('not.a.jwt');
    const response = await client.get(endpoints.patients);
    expect(response.status()).toBe(401);
    expect((await response.json()).message).toBe('Authentication token is invalid or expired');
    await client.dispose();
  });

  test('a token with a tampered payload is rejected (signature check)', async ({ session }) => {
    const [header, , signature] = session.tokens.receptionist.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ id: 1, email: users.admin.email, role: 'Admin', firstName: 'E2E', lastName: 'Forged' })).toString('base64url');
    const client = await ApiClient.create(`${header}.${forgedPayload}.${signature}`);
    expect((await client.get(endpoints.staff)).status()).toBe(401);
    await client.dispose();
  });

  test('an Authorization header without the Bearer scheme is rejected', async ({ session }) => {
    const client = await ApiClient.create();
    const response = await client.ctx.get(endpoints.patients, { headers: { Authorization: session.tokens.admin } });
    expect(response.status()).toBe(401);
    await client.dispose();
  });

  test('/auth/me returns the identity carried by the token', async ({ api }) => {
    const response = await api.pharmacist.get(endpoints.me);
    expect(response.status()).toBe(200);
    expect((await response.json()).data.user).toMatchObject({ email: users.pharmacist.email, role: 'Pharmacist' });
  });
});
