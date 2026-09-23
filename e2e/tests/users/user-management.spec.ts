import { test, expect, storageStatePath, users } from '../../fixtures';
import { ApiClient, errorBody } from '../../api/ApiClient';
import { activateInvitation, endpoints, inspectInvitation, userStatus } from '../../api/endpoints';
import type { InvitationPreview, UserRecord } from '../../api/types';
import { buildInvitation } from '../../fixtures/invitations';
import { env } from '../../config/env';
import { expireInvitation } from '../../utils/db';
import { ActivateAccountPage } from '../../pages';

test.use({ storageState: storageStatePath('admin') });

test.describe('Staff invitations (Admin) @api', () => {
  test('@smoke creates an invitation; the email is not sent because SMTP is not configured for this run', async ({ data }) => {
    const invite = await data.invitation({ role: 'Doctor' });

    expect(invite.invitationId).toBeGreaterThan(0);
    expect(invite.emailSent).toBe(false);
    expect(invite.emailDeliveryReason).toBe('not_configured');
    expect(invite.token).toBeTruthy();
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test('the invitation can be inspected publicly, without any token', async ({ anonymousApi, data }) => {
    const invite = await data.invitation({ firstName: 'E2E', lastName: 'Preview', role: 'Pharmacist' });

    const response = await anonymousApi.get(inspectInvitation(invite.token));

    expect(response.status()).toBe(200);
    const preview = (await response.json()).data as InvitationPreview;
    expect(preview).toMatchObject({ email: invite.email, firstName: 'E2E', lastName: 'Preview', role: 'Pharmacist' });
  });

  test('rejects an unknown activation token', async ({ anonymousApi }) => {
    const response = await anonymousApi.get(inspectInvitation('not-a-real-token'));
    expect(response.status()).toBe(400);
    expect((await errorBody(response)).message).toBe('Invitation is invalid or expired');
  });

  test('@smoke the invited person can activate their account and log in with the role they were given', async ({ anonymousApi, data }) => {
    const invite = await data.invitation({ role: 'Laboratory Staff' });

    const response = await anonymousApi.post(activateInvitation(invite.token), { password: env.userPassword });

    expect(response.status()).toBe(201);
    const body = (await response.json()).data;
    data.track('users', body.user.id);
    expect(body.user).toMatchObject({ email: invite.email, firstName: invite.firstName, lastName: invite.lastName, role: 'Laboratory Staff' });
    expect(body.token).toBeTruthy();

    const login = await ApiClient.login(invite.email, env.userPassword);
    expect(login.result?.user.role).toBe('Laboratory Staff');
  });

  test('requires a password of at least 8 characters', async ({ anonymousApi, data }) => {
    const invite = await data.invitation();
    const response = await anonymousApi.post(activateInvitation(invite.token), { password: 'short' });
    expect(response.status()).toBe(422);
  });

  test('a token can only be used once', async ({ anonymousApi, data }) => {
    const invite = await data.invitation();
    const first = await anonymousApi.post(activateInvitation(invite.token), { password: env.userPassword });
    expect(first.status()).toBe(201);
    data.track('users', (await first.json()).data.user.id);

    const second = await anonymousApi.post(activateInvitation(invite.token), { password: env.userPassword });
    expect(second.status()).toBe(400);
  });

  test('re-inviting the same email supersedes the earlier invitation', async ({ anonymousApi, data }) => {
    const email = buildInvitation().email;
    const first = await data.invitation({ email });
    const second = await data.invitation({ email });
    expect(second.token).not.toBe(first.token);

    const useOld = await anonymousApi.post(activateInvitation(first.token), { password: env.userPassword });
    expect(useOld.status()).toBe(400);

    const useNew = await anonymousApi.post(activateInvitation(second.token), { password: env.userPassword });
    expect(useNew.status()).toBe(201);
    data.track('users', (await useNew.json()).data.user.id);
  });

  test('cannot invite an email that already has an account', async ({ api }) => {
    const response = await api.admin.post(endpoints.invitations, buildInvitation({ email: users.doctor.email }));
    expect(response.status()).toBe(409);
  });

  test('requires first name, last name and a valid email', async ({ api }) => {
    const response = await api.admin.post(endpoints.invitations, { firstName: 'X' });
    expect(response.ok()).toBe(false);
  });

  test('only an Admin can create invitations', async ({ api }) => {
    for (const role of ['doctor', 'receptionist', 'laboratory', 'pharmacist', 'accountant'] as const) {
      const response = await api[role].post(endpoints.invitations, buildInvitation());
      expect(response.status(), role).toBe(403);
    }
  });

  test.describe('expiry', () => {
    test.skip(!env.databaseUrl, 'needs E2E_DATABASE_URL to fast-forward an invitation past its expiry');

    test('an expired invitation cannot be inspected or activated', async ({ anonymousApi, data }) => {
      const invite = await data.invitation();
      await expireInvitation(invite.email);

      const inspect = await anonymousApi.get(inspectInvitation(invite.token));
      expect(inspect.status()).toBe(400);

      const activate = await anonymousApi.post(activateInvitation(invite.token), { password: env.userPassword });
      expect(activate.status()).toBe(400);
    });
  });
});

test.describe('Staff directory (Admin) @api', () => {
  test('@smoke lists every user, newly activated staff included, without password hashes', async ({ api, anonymousApi, data }) => {
    const invite = await data.invitation({ role: 'Accountant' });
    const activateResponse = await anonymousApi.post(activateInvitation(invite.token), { password: env.userPassword });
    const newUserId = (await activateResponse.json()).data.user.id;
    data.track('users', newUserId);

    const listed = await api.admin.getData<{ users: UserRecord[] }>(endpoints.users);

    const created = listed.users.find((u) => u.id === newUserId);
    expect(created).toMatchObject({ email: invite.email, role: 'Accountant', isActive: true });
    expect(created).not.toHaveProperty('passwordHash');
  });

  test('@smoke Admin deactivates and reactivates a staff member; login is blocked while inactive', async ({ api, anonymousApi, data }) => {
    const invite = await data.invitation({ role: 'Nurse' });
    const activateResponse = await anonymousApi.post(activateInvitation(invite.token), { password: env.userPassword });
    const userId = (await activateResponse.json()).data.user.id;
    data.track('users', userId);

    const deactivated = await api.admin.patchData<{ user: UserRecord; isActive: boolean }>(userStatus(userId), { isActive: false });
    expect(deactivated.isActive).toBe(false);
    expect((await ApiClient.login(invite.email, env.userPassword)).status).toBe(401);

    const reactivated = await api.admin.patchData<{ user: UserRecord; isActive: boolean }>(userStatus(userId), { isActive: true });
    expect(reactivated.isActive).toBe(true);
    expect((await ApiClient.login(invite.email, env.userPassword)).result?.user.email).toBe(invite.email);
  });

  test('Admin cannot deactivate their own account', async ({ api, session }) => {
    const response = await api.admin.patch(userStatus(session.users.admin.id), { isActive: false });
    expect(response.status()).toBe(400);
    expect((await errorBody(response)).message).toBe('You cannot deactivate your own account');
  });

  test('returns 404 for an unknown user', async ({ api }) => {
    const response = await api.admin.patch(userStatus(2_147_483_647), { isActive: false });
    expect(response.status()).toBe(404);
  });

  test('rejects a non-boolean isActive value', async ({ api, session }) => {
    const response = await api.admin.patch(userStatus(session.users.doctor.id), { isActive: 'nope' });
    expect(response.status()).toBe(422);
  });

  test('only an Admin can list users or change status', async ({ api, data }) => {
    const someone = await data.user('Nurse');
    for (const role of ['doctor', 'receptionist', 'laboratory', 'pharmacist', 'accountant'] as const) {
      expect((await api[role].get(endpoints.users)).status(), `${role} list`).toBe(403);
      expect((await api[role].patch(userStatus(someone.id), { isActive: false })).status(), `${role} patch`).toBe(403);
    }
  });
});

test.describe('User management screen (UI)', () => {
  test.beforeEach(async ({ userManagementPage }) => {
    await userManagementPage.open();
  });

  test('@smoke Admin invites staff through the form and gets a copyable activation link', async ({ userManagementPage, data }) => {
    const invite = buildInvitation({ role: 'Doctor' });

    const result = await userManagementPage.invite(invite);

    expect(result.status).toBe(201);
    data.track('invitations', result.body.data!.invitationId);
    await expect(userManagementPage.notice).toContainText(invite.email);
    await expect(userManagementPage.invitationDelivery).toBeVisible();
    await expect(userManagementPage.invitationLink).toHaveValue(new RegExp(`/activate/${result.body.data!.token}$`));
  });

  test('the activation link from the UI actually activates the account', async ({ userManagementPage, browser, data }) => {
    const invite = buildInvitation({ role: 'Pharmacist' });
    const result = await userManagementPage.invite(invite);
    data.track('invitations', result.body.data!.invitationId);

    const context = await browser.newContext();
    try {
      const anonymousPage = await context.newPage();
      const activatePage = new ActivateAccountPage(anonymousPage);
      await activatePage.open(result.body.data!.token);
      const response = await activatePage.activate(env.userPassword);

      expect(response.status()).toBe(201);
      data.track('users', (await response.json()).data.user.id);
      await expect(anonymousPage).toHaveURL('/');
    } finally {
      await context.close();
    }
  });

  test('requires first name, last name and email before an invitation can be submitted', async ({ userManagementPage }) => {
    for (const field of [userManagementPage.inviteFirstName, userManagementPage.inviteLastName, userManagementPage.inviteEmail]) {
      expect(await field.evaluate((el) => !(el as HTMLInputElement).checkValidity())).toBe(true);
    }
  });

  test('@smoke Admin deactivates and reactivates a staff member from the table', async ({ userManagementPage, anonymousApi, data }) => {
    const invite = await data.invitation({ role: 'Nurse' });
    const activateResponse = await anonymousApi.post(activateInvitation(invite.token), { password: env.userPassword });
    const userId = (await activateResponse.json()).data.user.id;
    data.track('users', userId);

    await userManagementPage.refresh();
    const row = userManagementPage.rowByEmail(invite.email);
    await expect(row).toContainText('Active');

    await userManagementPage.toggleStatus(userId);
    await expect(row).toContainText('Inactive');
    await expect(userManagementPage.notice).toContainText('inactive');

    await userManagementPage.toggleStatus(userId);
    await expect(row).toContainText('Active');
  });

  test("Admin's own row has a disabled toggle button", async ({ userManagementPage, session }) => {
    await expect(userManagementPage.toggleButton(session.users.admin.id)).toBeDisabled();
  });

  test('search filters the staff table client-side', async ({ userManagementPage, anonymousApi, data }) => {
    const invite = await data.invitation({ firstName: 'Zzsearch', role: 'Doctor' });
    const activateResponse = await anonymousApi.post(activateInvitation(invite.token), { password: env.userPassword });
    data.track('users', (await activateResponse.json()).data.user.id);

    await userManagementPage.refresh();
    await expect(userManagementPage.rowByEmail(invite.email)).toBeVisible();

    await userManagementPage.search('zzsearch');
    await expect(userManagementPage.rowByEmail(invite.email)).toBeVisible();
    await expect(userManagementPage.rows).toHaveCount(1);

    await userManagementPage.search('no-such-person-xyz');
    await expect(userManagementPage.rows).toHaveCount(0);
  });
});
