import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';
import type { TestUser } from '../fixtures/users';

const LOGIN_RESPONSE_TIMEOUT = 30_000;
const isLoginRequest = (r: Response): boolean => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST';

export class LoginPage extends BasePage {
  readonly form: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId('login-form');
    this.email = page.getByTestId('login-email');
    this.password = page.getByTestId('login-password');
    this.submitButton = page.getByTestId('login-submit');
    this.error = page.getByTestId('login-error');
  }

  async open(): Promise<void> {
    await this.navigate('/login');
    await expect(this.form).toBeVisible();
  }

  async fill(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
  }

  /** Fills the form, submits and returns the POST /auth/login response. */
  async login(email: string, password: string): Promise<Response> {
    await this.fill(email, password);
    // bcrypt (cost 12, pure JS) blocks the API's event loop, so parallel logins queue up: allow extra time.
    const [response] = await Promise.all([
      this.page.waitForResponse(isLoginRequest, { timeout: LOGIN_RESPONSE_TIMEOUT }),
      this.submitButton.click()
    ]);
    return response;
  }

  async loginAs(user: TestUser): Promise<Response> {
    return this.login(user.email, user.password);
  }

  /** True when the browser's built-in validation blocked the submit (no request is sent). */
  async isFieldInvalid(field: 'email' | 'password'): Promise<boolean> {
    const input = field === 'email' ? this.email : this.password;
    return input.evaluate((el) => !(el as HTMLInputElement).checkValidity());
  }
}
