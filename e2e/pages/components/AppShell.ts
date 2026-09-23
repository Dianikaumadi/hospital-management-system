import { expect, Locator, Page } from '@playwright/test';

export type NavItem =
  | 'dashboard' | 'patients' | 'appointments' | 'doctors' | 'medical-records' | 'laboratory' | 'pharmacy' | 'billing'
  | 'user-management';

/** The authenticated layout: sidebar navigation, user badge and sign-out. */
export class AppShell {
  readonly userName: Locator;
  readonly userRole: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.userName = page.getByTestId('user-name');
    this.userRole = page.getByTestId('user-role');
    this.logoutButton = page.getByTestId('logout-button');
  }

  nav(item: NavItem): Locator {
    return this.page.getByTestId(`nav-${item}`);
  }

  async goTo(item: NavItem): Promise<void> {
    await this.nav(item).click();
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
    await expect(this.page).toHaveURL(/\/login$/);
  }
}
