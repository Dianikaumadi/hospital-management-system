import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';
import type { InvitationInput } from '../fixtures/invitations';

const isUsersListResponse = (r: Response): boolean =>
  r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/users';
const isInviteResponse = (r: Response): boolean =>
  r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/users/invitations';

export interface InviteResult {
  response: Response;
  status: number;
  body: { success: boolean; data?: { invitationId: number; token: string; emailSent: boolean }; message?: string };
}

/** The Admin-only /users screen: staff directory plus the "Invite Staff" form. */
export class UserManagementPage extends BasePage {
  readonly title: Locator;
  readonly error: Locator;
  readonly notice: Locator;
  readonly searchInput: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly inviteForm: Locator;
  readonly inviteFirstName: Locator;
  readonly inviteLastName: Locator;
  readonly inviteEmail: Locator;
  readonly inviteRole: Locator;
  readonly inviteSubmit: Locator;
  readonly invitationDelivery: Locator;
  readonly invitationLink: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.getByTestId('user-management-title');
    this.error = page.getByTestId('user-management-error');
    this.notice = page.getByTestId('user-management-notice');
    this.searchInput = page.getByTestId('user-search');
    this.table = page.getByTestId('users-table');
    this.rows = page.getByTestId('user-row');
    this.inviteForm = page.getByTestId('invite-staff-form');
    this.inviteFirstName = page.getByTestId('invite-first-name');
    this.inviteLastName = page.getByTestId('invite-last-name');
    this.inviteEmail = page.getByTestId('invite-email');
    this.inviteRole = page.getByTestId('invite-role');
    this.inviteSubmit = page.getByTestId('invite-submit');
    this.invitationDelivery = page.getByTestId('invitation-delivery');
    this.invitationLink = page.getByTestId('invitation-link');
  }

  /** Loads /users directly and waits for the staff list to load. */
  async open(): Promise<Response> {
    const [response] = await Promise.all([this.page.waitForResponse(isUsersListResponse), this.page.goto('/users')]);
    await expect(this.title).toBeVisible();
    return response;
  }

  /** Opens User management through the sidebar, as an Admin would. */
  async openFromSidebar(): Promise<Response> {
    const [response] = await Promise.all([this.page.waitForResponse(isUsersListResponse), this.shell.goTo('user-management')]);
    await expect(this.title).toBeVisible();
    return response;
  }

  async refresh(): Promise<Response> {
    const [response] = await Promise.all([this.page.waitForResponse(isUsersListResponse), this.page.reload()]);
    await expect(this.title).toBeVisible();
    return response;
  }

  rowByEmail(email: string): Locator {
    return this.rows.filter({ hasText: email });
  }

  toggleButton(userId: number): Locator {
    return this.page.getByTestId(`toggle-user-${userId}`);
  }

  async search(term: string): Promise<void> {
    // Client-side filter (no request round-trip) - just fill and let React re-render.
    await this.searchInput.fill(term);
  }

  async fillInvite(values: InvitationInput): Promise<void> {
    await this.inviteFirstName.fill(values.firstName);
    await this.inviteLastName.fill(values.lastName);
    await this.inviteEmail.fill(values.email);
    await this.inviteRole.selectOption(values.role);
  }

  /**
   * Fills and submits the invite form. The invitee does not become a row in the staff table until
   * they activate their account, so this only waits for the invitation response itself - use
   * `rowByEmail` after activation to confirm the resulting account.
   */
  async invite(values: InvitationInput): Promise<InviteResult> {
    await this.fillInvite(values);
    const [response] = await Promise.all([this.page.waitForResponse(isInviteResponse), this.inviteSubmit.click()]);
    return { response, status: response.status(), body: await response.json() };
  }

  async toggleStatus(userId: number): Promise<void> {
    await this.toggleButton(userId).click();
  }
}
