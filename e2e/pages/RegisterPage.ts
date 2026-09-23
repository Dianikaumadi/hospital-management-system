import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

const isRegisterRequest = (r: Response): boolean => r.url().endsWith('/api/auth/register') && r.request().method() === 'POST';

/**
 * The public "Create account" screen. POST /auth/register is admin-only on the backend, so this
 * form can never succeed for an anonymous visitor - see tests/auth/registration.spec.ts.
 */
export class RegisterPage extends BasePage {
  readonly form: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly confirmPassword: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId('register-form');
    this.firstName = page.getByTestId('register-first-name');
    this.lastName = page.getByTestId('register-last-name');
    this.email = page.getByTestId('register-email');
    this.password = page.getByTestId('register-password');
    this.confirmPassword = page.getByTestId('register-confirm-password');
    this.submitButton = page.getByTestId('register-submit');
    this.error = page.getByTestId('register-error');
  }

  async open(): Promise<void> {
    await this.navigate('/register');
    await expect(this.form).toBeVisible();
  }

  async fill(values: { firstName: string; lastName: string; email: string; password: string; confirmPassword: string }): Promise<void> {
    await this.firstName.fill(values.firstName);
    await this.lastName.fill(values.lastName);
    await this.email.fill(values.email);
    await this.password.fill(values.password);
    await this.confirmPassword.fill(values.confirmPassword);
  }

  /** Submits and returns the POST /auth/register response (the backend always rejects it as 401 - no token). */
  async submit(): Promise<Response> {
    const [response] = await Promise.all([this.page.waitForResponse(isRegisterRequest), this.submitButton.click()]);
    return response;
  }
}
