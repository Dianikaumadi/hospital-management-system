import { test, expect, ROLE_KEYS, users } from '../../fixtures';
import { DashboardPage, LoginPage } from '../../pages';

test.describe('Authentication - logout', () => {
  for (const key of ROLE_KEYS) {
    test(`@smoke ${users[key].role} can sign out and the session is cleared`, async ({ pageAs }) => {
      const page = await pageAs(key);
      const dashboard = new DashboardPage(page);
      await dashboard.open();
      await expect(dashboard.shell.userRole).toHaveText(users[key].role);

      await dashboard.shell.logout();

      await expect(new LoginPage(page).form).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('hms_token'))).toBeNull();
      expect(await page.evaluate(() => localStorage.getItem('hms_user'))).toBeNull();
    });
  }

  test('protected pages are inaccessible after logout, including via browser history', async ({ pageAs }) => {
    const page = await pageAs('receptionist');
    const dashboard = new DashboardPage(page);
    await dashboard.open();
    await page.goto('/patients');
    await expect(page.getByTestId('module-title')).toHaveText('Patients');

    await dashboard.shell.logout();
    await page.goBack();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/patients');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('user can sign in again after signing out', async ({ pageAs }) => {
    const other = await pageAs('admin');
    const dashboard = new DashboardPage(other);
    await dashboard.open();
    await dashboard.shell.logout();

    const login = new LoginPage(other);
    const response = await login.loginAs(users.admin);
    expect(response.status()).toBe(200);
    await expect(other).toHaveURL('/');
  });
});
