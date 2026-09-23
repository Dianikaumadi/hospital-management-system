import { test, expect, ROLE_KEYS, users } from '../../fixtures';
import { fullName, invalidCredentials } from '../../fixtures/users';
import { decodeJwt } from '../../utils/jwt';

test.describe('Authentication - login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.open();
  });

  for (const key of ROLE_KEYS) {
    const user = users[key];

    test(`@smoke ${user.role} logs in and is redirected to the dashboard`, async ({ page, loginPage, dashboardPage }) => {
      const response = await loginPage.loginAs(user);

      // API contract
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.user).toMatchObject({ email: user.email, role: user.role });
      expect(decodeJwt(body.data.token)).toMatchObject({ email: user.email, role: user.role });

      // UI: redirect + identity shown in the header
      await expect(page).toHaveURL('/');
      await expect(dashboardPage.title).toBeVisible();
      await expect(dashboardPage.shell.userName).toHaveText(fullName(user));
      await expect(dashboardPage.shell.userRole).toHaveText(user.role);

      // Session persisted for subsequent API calls
      expect(await page.evaluate(() => localStorage.getItem('hms_token'))).toBe(body.data.token);
    });
  }

  test('@smoke rejects a wrong password with an error message', async ({ page, loginPage }) => {
    const response = await loginPage.login(invalidCredentials.wrongPassword.email, invalidCredentials.wrongPassword.password);

    expect(response.status()).toBe(401);
    expect((await response.json()).message).toBe('Invalid email or password');
    await expect(loginPage.error).toHaveText('Invalid email or password');
    await expect(page).toHaveURL(/\/login$/);
    await expect(loginPage.submitButton).toBeEnabled();
    expect(await page.evaluate(() => localStorage.getItem('hms_token'))).toBeNull();
  });

  test('rejects an unknown account without revealing whether the email exists', async ({ page, loginPage }) => {
    const response = await loginPage.login(invalidCredentials.unknownUser.email, invalidCredentials.unknownUser.password);

    expect(response.status()).toBe(401);
    await expect(loginPage.error).toHaveText('Invalid email or password'); // identical to wrong-password message
    await expect(page).toHaveURL(/\/login$/);
  });

  test('clears the error message on the next successful attempt', async ({ page, loginPage }) => {
    await loginPage.login(users.admin.email, 'wrong-password');
    await expect(loginPage.error).toBeVisible();

    const response = await loginPage.loginAs(users.admin);
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL('/');
  });

  test('blocks submission of an empty form (required fields)', async ({ page, loginPage }) => {
    const loginRequests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/auth/login')) loginRequests.push(r.url()); });

    await loginPage.submitButton.click();

    expect(await loginPage.isFieldInvalid('email')).toBe(true);
    expect(await loginPage.isFieldInvalid('password')).toBe(true);
    await expect(page).toHaveURL(/\/login$/);
    expect(loginRequests).toHaveLength(0);
  });

  test('blocks submission of a malformed email address', async ({ page, loginPage }) => {
    await loginPage.fill('not-an-email', 'whatever123');
    await loginPage.submitButton.click();

    expect(await loginPage.isFieldInvalid('email')).toBe(true);
    await expect(loginPage.error).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('masks the password field', async ({ loginPage }) => {
    await expect(loginPage.password).toHaveAttribute('type', 'password');
  });
});

test.describe('Authentication - login API @api', () => {
  test('rejects a malformed email with a validation error (422)', async ({ anonymousApi }) => {
    const response = await anonymousApi.post('auth/login', { email: "' OR 1=1 --", password: 'x' });
    expect(response.status()).toBe(422);
    expect((await response.json()).message).toBe('Validation failed');
  });

  test('rejects a missing password (422)', async ({ anonymousApi }) => {
    const response = await anonymousApi.post('auth/login', { email: users.admin.email });
    expect(response.status()).toBe(422);
  });

  test('email lookup is case-insensitive', async ({ anonymousApi }) => {
    const response = await anonymousApi.post('auth/login', { email: users.admin.email.toUpperCase(), password: users.admin.password });
    expect(response.status()).toBe(200);
  });

  test('issues a token that expires in the future', async ({ anonymousApi }) => {
    const response = await anonymousApi.post('auth/login', { email: users.doctor.email, password: users.doctor.password });
    const { token } = (await response.json()).data;
    const { exp, iat } = decodeJwt(token);
    expect(exp).toBeGreaterThan(Date.now() / 1000);
    expect(exp - iat).toBeGreaterThan(0);
  });
});
