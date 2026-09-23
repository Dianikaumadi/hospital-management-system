import { test, expect, storageStatePath } from '../../fixtures';
import { endpoints } from '../../api/endpoints';
import type { Appointment, AppointmentStatus } from '../../api/types';
import { APPOINTMENT_STATUSES } from '../../fixtures/appointments';
import { futureSlot } from '../../utils/dates';

test.use({ storageState: storageStatePath('receptionist') });

test.describe('Appointments - booking (UI)', () => {
  test.beforeEach(async ({ appointmentsPage }) => {
    await appointmentsPage.open();
  });

  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke books an appointment: select patient, select doctor, select date, save', async ({ appointmentsPage, api, data, session }) => {
    const patient = await data.patient();
    const startsAt = futureSlot(10, 11);

    const result = await appointmentsPage.create({
      patientId: patient.id, doctorId: session.doctorId, startsAt, reason: 'Annual physical examination'
    });

    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({
      patientId: patient.id, doctorId: session.doctorId, startsAt, reason: 'Annual physical examination', status: 'Scheduled'
    });
    const id = result.body.data!.id;
    data.track('appointments', id);

    await expect(appointmentsPage.form).toBeHidden();
    await expect(appointmentsPage.notice).toHaveText('Appointment saved successfully');
    await appointmentsPage.expectRow(id, { patientId: patient.id, doctorId: session.doctorId, startsAt, status: 'Scheduled' });

    expect(await api.receptionist.getData<Appointment>(`${endpoints.appointments}/${id}`)).toMatchObject({ status: 'Scheduled', startsAt });
  });

  test('requires patient, doctor, date and reason', async ({ page, appointmentsPage }) => {
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

    await appointmentsPage.openForm();
    await appointmentsPage.submitButton.click();

    for (const field of ['patientId', 'doctorId', 'startsAt', 'reason'] as const) {
      expect(await appointmentsPage.isFieldInvalid(field), field).toBe(true);
    }
    expect(posts).toHaveLength(0);
  });

  test('rejects an unknown patient', async ({ appointmentsPage, session }) => {
    const result = await appointmentsPage.create({ patientId: 2_147_483_000, doctorId: session.doctorId, startsAt: futureSlot(), reason: 'x' });

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(appointmentsPage.formError).toBeVisible();
    await expect(appointmentsPage.notice).toHaveCount(0);
  });

  test('rejects an unknown doctor', async ({ appointmentsPage, data }) => {
    const patient = await data.patient();

    const result = await appointmentsPage.create({ patientId: patient.id, doctorId: 2_147_483_000, startsAt: futureSlot(), reason: 'x' });

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(appointmentsPage.formError).toBeVisible();
  });

  test('rejects an invalid date', async ({ appointmentsPage, data, session }) => {
    const patient = await data.patient();

    const result = await appointmentsPage.create({ patientId: patient.id, doctorId: session.doctorId, startsAt: 'not-a-date', reason: 'x' });

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(appointmentsPage.formError).toBeVisible();
  });

  test('lists appointments with the expected columns', async ({ appointmentsPage, data }) => {
    const appointment = await data.appointment();

    await appointmentsPage.refresh();

    await expect(appointmentsPage.table.locator('thead th')).toHaveText(['ID', 'patientId', 'doctorId', 'startsAt', 'status']);
    await appointmentsPage.expectRow(appointment.id, {
      id: `#${appointment.id}`, patientId: appointment.patientId, doctorId: appointment.doctorId,
      startsAt: appointment.startsAt, status: 'Scheduled'
    });
  });
});

test.describe('Appointments - status workflow', () => {
  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  for (const status of APPOINTMENT_STATUSES.filter((s) => s !== 'Scheduled')) {
    test(`@smoke Scheduled -> ${status}: API persists it and the UI list shows it`, async ({ api, data, appointmentsPage }) => {
      const appointment = await data.appointment();
      expect(appointment.status).toBe('Scheduled');

      const response = await api.receptionist.patch(`${endpoints.appointments}/${appointment.id}`, { status });

      expect(response.status()).toBe(200);
      expect((await response.json()).data).toMatchObject({ id: appointment.id, status });
      expect((await api.receptionist.getData<Appointment>(`${endpoints.appointments}/${appointment.id}`)).status).toBe(status);

      await appointmentsPage.open();
      await appointmentsPage.expectRow(appointment.id, { status });
    });
  }

  test('a booked appointment is shown as Scheduled in the UI before any change', async ({ data, appointmentsPage }) => {
    const appointment = await data.appointment();
    await appointmentsPage.open();
    await appointmentsPage.expectRow(appointment.id, { status: 'Scheduled' });
  });

  test('complete workflow: book in the UI, doctor completes the visit, status is visible to reception', async ({ appointmentsPage, api, data, session }) => {
    const patient = await data.patient();

    // 1. Reception books it through the form
    await appointmentsPage.open();
    const created = await appointmentsPage.create({
      patientId: patient.id, doctorId: session.doctorId, startsAt: futureSlot(3, 15), reason: 'Follow-up'
    });
    expect(created.status).toBe(201);
    const id = created.body.data!.id;
    data.track('appointments', id);
    await appointmentsPage.expectRow(id, { status: 'Scheduled' });

    // 2. The doctor completes it
    const completed = await api.doctor.patch(`${endpoints.appointments}/${id}`, { status: 'Completed' });
    expect(completed.status()).toBe(200);

    // 3. Reception sees the new status
    await appointmentsPage.refresh();
    await appointmentsPage.expectRow(id, { status: 'Completed', patientId: patient.id });
  });

  test('cancelling keeps the appointment on record with status Cancelled', async ({ api, data, appointmentsPage }) => {
    const appointment = await data.appointment();

    await api.receptionist.patchData<Appointment>(`${endpoints.appointments}/${appointment.id}`, { status: 'Cancelled' });

    await appointmentsPage.open();
    await appointmentsPage.expectRow(appointment.id, { status: 'Cancelled', patientId: appointment.patientId });
    const listed = (await api.receptionist.list<Appointment>(endpoints.appointments)).find((a) => a.id === appointment.id);
    expect(listed?.status).toBe('Cancelled');
  });

  test('an appointment can be rescheduled without changing its status', async ({ api, data }) => {
    const appointment = await data.appointment();
    const newSlot = futureSlot(30, 14);

    const updated = await api.receptionist.patchData<Appointment>(`${endpoints.appointments}/${appointment.id}`, { startsAt: newSlot });

    expect(updated).toMatchObject({ startsAt: newSlot, status: 'Scheduled' });
  });

  test('rejects an unknown status and leaves the appointment unchanged', async ({ api, data }) => {
    const appointment = await data.appointment();

    const response = await api.receptionist.patch(`${endpoints.appointments}/${appointment.id}`, { status: 'Postponed' });

    expect(response.ok()).toBe(false);
    expect((await api.receptionist.getData<Appointment>(`${endpoints.appointments}/${appointment.id}`)).status).toBe('Scheduled');
  });

  test('laboratory staff cannot change appointment status', async ({ api, data }) => {
    const appointment = await data.appointment();
    const response = await api.laboratory.patch(`${endpoints.appointments}/${appointment.id}`, { status: 'Cancelled' });
    expect(response.status()).toBe(403);
    expect((await api.receptionist.getData<Appointment>(`${endpoints.appointments}/${appointment.id}`)).status).toBe('Scheduled');
  });

  test('each appointment keeps its own status independently', async ({ api, data, appointmentsPage }) => {
    const patient = await data.patient();
    const statuses: AppointmentStatus[] = ['Completed', 'Cancelled', 'No-show'];
    const appointments = [];
    for (const status of statuses) {
      const a = await data.appointment({ patientId: patient.id });
      await api.receptionist.patchData<Appointment>(`${endpoints.appointments}/${a.id}`, { status });
      appointments.push({ id: a.id, status });
    }
    const untouched = await data.appointment({ patientId: patient.id });

    await appointmentsPage.open();
    for (const { id, status } of appointments) await appointmentsPage.expectRow(id, { status });
    await appointmentsPage.expectRow(untouched.id, { status: 'Scheduled' });
  });
});
