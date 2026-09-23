import { test, expect } from '../../fixtures';
import { ApiClient } from '../../api/ApiClient';
import { endpoints } from '../../api/endpoints';
import { env } from '../../config/env';
import { uid } from '../../utils/random';

/**
 * POST /auth/register is admin-only by design (backend README: "anonymous registration is
 * intentionally disabled"). The public "Create account" screen therefore can never succeed for an
 * unauthenticated visitor - staff are onboarded through an invitation instead
 * (see tests/users/user-management.spec.ts). These tests document that lockdown, not a bug.
 */
test.describe('Self-registration is intentionally blocked (UI)', () => {
  test('@smoke the public register form cannot create an account and sends the visitor to /login', async ({ page, registerPage }) => {
    const email = `e2e.selfsignup.${uid()}@${env.emailDomain}`;
    await registerPage.open();
    await registerPage.fill({ firstName: 'E2E', lastName: 'SelfSignup', email, password: 'Whatever#123', confirmPassword: 'Whatever#123' });

    const response = await registerPage.submit();

    expect(response.status()).toBe(401); // authenticate runs before authorize('Admin') - no token at all here
    // The axios 401 interceptor drops any (nonexistent) session and sends the visitor to /login.
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('hms_token'))).toBeNull();

    const login = await ApiClient.login(email, 'Whatever#123');
    expect(login.status).toBe(401); // no account was created
  });

  test('rejects a mismatched password confirmation before ever calling the API', async ({ page, registerPage }) => {
    const posts: string[] = [];
    page.on('request', (r) => { if (r.url().endsWith('/api/auth/register')) posts.push(r.url()); });
    await registerPage.open();
    await registerPage.fill({
      firstName: 'E2E', lastName: 'Mismatch', email: `e2e.mismatch.${uid()}@${env.emailDomain}`,
      password: 'Whatever#123', confirmPassword: 'Different#123'
    });

    await registerPage.submitButton.click();

    await expect(registerPage.error).toHaveText('Passwords do not match');
    expect(posts).toHaveLength(0);
    await expect(page).toHaveURL(/\/register$/);
  });

  test('requires first name, last name, email and an 8+ character password', async ({ registerPage }) => {
    await registerPage.open();
    await registerPage.submitButton.click();

    for (const field of [registerPage.firstName, registerPage.lastName, registerPage.email, registerPage.password, registerPage.confirmPassword]) {
      expect(await field.evaluate((el) => !(el as HTMLInputElement).checkValidity())).toBe(true);
    }
  });

  test('the login page links to the (non-functional) register form', async ({ page, loginPage }) => {
    await loginPage.open();
    await page.getByRole('link', { name: 'Create one' }).click();
    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe('Self-registration is intentionally blocked (API) @api', () => {
  test('POST /auth/register without a token is rejected regardless of the body', async ({ anonymousApi }) => {
    const email = `e2e.blocked.${uid()}@${env.emailDomain}`;
    const response = await anonymousApi.post(endpoints.register, { firstName: 'E2E', lastName: 'Blocked', email, password: 'Whatever#123' });

    expect(response.status()).toBe(401);
    expect((await ApiClient.login(email, 'Whatever#123')).status).toBe(401);
  });

  test('POST /auth/register with a non-admin token is forbidden and creates nothing', async ({ api }) => {
    const email = `e2e.blocked.${uid()}@${env.emailDomain}`;
    const response = await api.doctor.post(endpoints.register, { firstName: 'E2E', lastName: 'Blocked', email, password: 'Whatever#123', role: 'Nurse' });

    expect(response.status()).toBe(403);
    expect((await ApiClient.login(email, 'Whatever#123')).status).toBe(401);
  });

  test('an Admin can still register a user directly with a password (no invitation needed)', async ({ api, data }) => {
    const email = `e2e.direct.${uid()}@${env.emailDomain}`;

    const response = await api.admin.post(endpoints.register, { firstName: 'E2E', lastName: 'Direct', email, password: 'Whatever#123', role: 'Nurse' });

    expect(response.status()).toBe(201);
    data.track('users', (await response.json()).data.user.id);
    const login = await ApiClient.login(email, 'Whatever#123');
    expect(login.result?.user).toMatchObject({ email, role: 'Nurse' });
  });
});
