import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

const isActivateRequest = (r: Response): boolean => /\/api\/auth\/invitations\/[^/]+\/activate$/.test(r.url()) && r.request().method() === 'POST';

/** The /activate/:token screen a new staff member lands on from their invitation link. */
export class ActivateAccountPage extends BasePage {
  readonly form: Locator;
  readonly password: Locator;
  readonly confirmPassword: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId('activate-account-form');
    this.password = page.getByTestId('activate-password');
    this.confirmPassword = page.getByTestId('activate-confirm-password');
    this.submitButton = page.getByTestId('activate-submit');
    this.error = page.getByTestId('activation-error');
  }

  async open(token: string): Promise<void> {
    await this.navigate(`/activate/${token}`);
  }

  async activate(password: string, confirmPassword = password): Promise<Response> {
    await expect(this.form).toBeVisible();
    await this.password.fill(password);
    await this.confirmPassword.fill(confirmPassword);
    const [response] = await Promise.all([this.page.waitForResponse(isActivateRequest), this.submitButton.click()]);
    return response;
  }
}
