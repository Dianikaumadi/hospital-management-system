import { test, expect, storageStatePath } from '../../fixtures';
import { endpoints } from '../../api/endpoints';
import type { Invoice, InvoiceStatus } from '../../api/types';
import { buildInvoice, DEFAULT_LINES } from '../../fixtures/invoices';
import { calcInvoiceTotal } from '../../utils/money';
import { uid } from '../../utils/random';

test.use({ storageState: storageStatePath('accountant') });

test.describe('Billing - invoices (UI)', () => {
  test.beforeEach(async ({ billingPage }) => {
    await billingPage.open();
  });

  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke creates an invoice through the form, starting as Pending', async ({ billingPage, api, data }) => {
    const patient = await data.patient();
    const invoiceNumber = `e2e-inv-${uid()}`;

    const result = await billingPage.create({ patientId: patient.id, invoiceNumber, total: '1450.75' });

    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ patientId: patient.id, invoiceNumber, total: '1450.75', status: 'Pending', paidAt: null, items: [] });
    const id = result.body.data!.id;
    data.track('invoices', id);

    await expect(billingPage.form).toBeHidden();
    await expect(billingPage.notice).toHaveText('Invoice saved successfully');
    await billingPage.expectRow(id, { invoiceNumber, patientId: patient.id, total: '1450.75', status: 'Pending' });

    expect(await api.accountant.getData<Invoice>(`${endpoints.invoices}/${id}`)).toMatchObject({ invoiceNumber, total: '1450.75' });
  });

  test('requires patient, invoice number and total', async ({ page, billingPage }) => {
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

    await billingPage.openForm();
    await billingPage.submitButton.click();

    for (const field of ['patientId', 'invoiceNumber', 'total'] as const) {
      expect(await billingPage.isFieldInvalid(field), field).toBe(true);
    }
    expect(posts).toHaveLength(0);
  });

  test('rejects a duplicate invoice number', async ({ billingPage, data }) => {
    const existing = await data.invoice();

    const result = await billingPage.create({ patientId: existing.patientId, invoiceNumber: existing.invoiceNumber, total: 10 });

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(billingPage.formError).toBeVisible();
  });

  test('rejects an invoice for an unknown patient', async ({ billingPage }) => {
    const result = await billingPage.create({ patientId: 2_147_483_000, invoiceNumber: `e2e-inv-${uid()}`, total: 10 });

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(billingPage.formError).toBeVisible();
  });

  test('rejects a non-numeric total', async ({ billingPage, data }) => {
    const patient = await data.patient();

    const result = await billingPage.create({ patientId: patient.id, invoiceNumber: `e2e-inv-${uid()}`, total: 'lots' });

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(billingPage.formError).toBeVisible();
  });
});

test.describe('Billing - items and totals @api', () => {
  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke adds invoice items and the stored total equals the sum of the lines', async ({ api, data }) => {
    // 500.00 + 2 x 150.25 + 799.99 = 1600.49
    const expected = calcInvoiceTotal(DEFAULT_LINES);
    expect(expected).toBe(1600.49);

    const invoice = await data.invoice({ items: DEFAULT_LINES });

    const saved = await api.accountant.getData<Invoice>(`${endpoints.invoices}/${invoice.id}`);
    expect(saved.items).toEqual(DEFAULT_LINES);
    expect(Number(saved.total)).toBe(expected);
    expect(saved.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)).toBeCloseTo(Number(saved.total), 2);
  });

  test('adding an item to an existing invoice and recalculating updates the stored total', async ({ api, data }) => {
    const invoice = await data.invoice({ items: [DEFAULT_LINES[0]] });
    expect(Number(invoice.total)).toBe(500);

    const items = [...invoice.items, { description: 'Ultrasound', quantity: 1, unitPrice: 1200 }];
    const updated = await api.accountant.patchData<Invoice>(`${endpoints.invoices}/${invoice.id}`, { items, total: calcInvoiceTotal(items) });

    expect(updated.items).toHaveLength(2);
    const saved = await api.accountant.getData<Invoice>(`${endpoints.invoices}/${invoice.id}`);
    expect(Number(saved.total)).toBe(1700);
    expect(saved.items[1]).toEqual({ description: 'Ultrasound', quantity: 1, unitPrice: 1200 });
  });

  test('receptionists can also create invoices', async ({ api, data }) => {
    const patient = await data.patient();
    const invoice = await api.receptionist.postData<Invoice>(endpoints.invoices, buildInvoice(patient.id));
    data.track('invoices', invoice.id);
    expect(invoice.status).toBe('Pending');
  });

  test('requires an invoice number, patient and total', async ({ api }) => {
    const response = await api.accountant.post(endpoints.invoices, { items: DEFAULT_LINES });
    expect(response.ok()).toBe(false);
  });
});

test.describe('Billing - payment status', () => {
  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke Pending -> Partially Paid -> Paid, visible in the UI at each step', async ({ api, data, billingPage }) => {
    const invoice = await data.invoice();
    const url = `${endpoints.invoices}/${invoice.id}`;
    expect(invoice).toMatchObject({ status: 'Pending', paidAt: null });

    await billingPage.open();
    await billingPage.expectRow(invoice.id, { status: 'Pending' });

    // Partial payment
    const partial = await api.accountant.patchData<Invoice>(url, { status: 'Partially Paid' });
    expect(partial).toMatchObject({ status: 'Partially Paid', paidAt: null });
    await billingPage.refresh();
    await billingPage.expectRow(invoice.id, { status: 'Partially Paid', total: invoice.total });

    // Settled
    const paidAt = new Date().toISOString();
    const paid = await api.accountant.patchData<Invoice>(url, { status: 'Paid', paidAt });
    expect(paid).toMatchObject({ status: 'Paid', paidAt });
    await billingPage.refresh();
    await billingPage.expectRow(invoice.id, { status: 'Paid' });

    // Persisted, and the amount never changed along the way
    expect(await api.accountant.getData<Invoice>(url)).toMatchObject({ status: 'Paid', total: invoice.total });
  });

  for (const status of ['Pending', 'Partially Paid', 'Paid'] as InvoiceStatus[]) {
    test(`an invoice can be set to "${status}" directly`, async ({ api, data }) => {
      const invoice = await data.invoice();
      const updated = await api.accountant.patchData<Invoice>(`${endpoints.invoices}/${invoice.id}`, { status });
      expect(updated.status).toBe(status);
    });
  }

  test('rejects an unknown payment status', async ({ api, data }) => {
    const invoice = await data.invoice();
    const response = await api.accountant.patch(`${endpoints.invoices}/${invoice.id}`, { status: 'Overdue' });
    expect(response.ok()).toBe(false);
    expect((await api.accountant.getData<Invoice>(`${endpoints.invoices}/${invoice.id}`)).status).toBe('Pending');
  });

  test('pharmacists and laboratory staff cannot change payment status', async ({ api, data }) => {
    const invoice = await data.invoice();
    for (const role of ['pharmacist', 'laboratory', 'doctor'] as const) {
      expect((await api[role].patch(`${endpoints.invoices}/${invoice.id}`, { status: 'Paid' })).status(), role).toBe(403);
    }
    expect((await api.accountant.getData<Invoice>(`${endpoints.invoices}/${invoice.id}`)).status).toBe('Pending');
  });
});
