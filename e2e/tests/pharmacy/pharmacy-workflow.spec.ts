import { test, expect, storageStatePath } from '../../fixtures';
import { endpoints } from '../../api/endpoints';
import type { Medicine } from '../../api/types';
import { buildMedicine } from '../../fixtures/medicines';
import { dateOnly } from '../../utils/dates';

test.use({ storageState: storageStatePath('pharmacist') });

const isLowStock = (m: Pick<Medicine, 'quantity' | 'reorderLevel'>): boolean => m.quantity <= m.reorderLevel;
const isExpired = (m: Pick<Medicine, 'expiryDate'>, today = dateOnly(0)): boolean => m.expiryDate !== null && m.expiryDate < today;

test.describe('Pharmacy - medicines (UI)', () => {
  test.beforeEach(async ({ pharmacyPage }) => {
    await pharmacyPage.open();
  });

  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke creates a medicine through the form', async ({ pharmacyPage, api, data }) => {
    const input = buildMedicine({ quantity: 80, unitPrice: '12.50' });

    const result = await pharmacyPage.create({ name: input.name, sku: input.sku, quantity: input.quantity, unitPrice: input.unitPrice });

    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ name: input.name, sku: input.sku, quantity: 80, unitPrice: '12.50', reorderLevel: 10 });
    const id = result.body.data!.id;
    data.track('medicines', id);

    await expect(pharmacyPage.form).toBeHidden();
    await expect(pharmacyPage.notice).toHaveText('Medicine saved successfully');
    await pharmacyPage.expectRow(id, { name: input.name, sku: input.sku, quantity: 80 });
    await expect(pharmacyPage.cell(id, 'expiryDate')).toHaveText('—'); // the form does not capture an expiry date

    expect(await api.pharmacist.getData<Medicine>(`${endpoints.medicines}/${id}`)).toMatchObject({ sku: input.sku, quantity: 80 });
  });

  test('requires name, SKU, quantity and unit price', async ({ page, pharmacyPage }) => {
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });

    await pharmacyPage.openForm();
    await pharmacyPage.submitButton.click();

    for (const field of ['name', 'sku', 'quantity', 'unitPrice'] as const) {
      expect(await pharmacyPage.isFieldInvalid(field), field).toBe(true);
    }
    expect(posts).toHaveLength(0);
  });

  test('rejects a duplicate SKU', async ({ pharmacyPage, data }) => {
    const existing = await data.medicine();

    const result = await pharmacyPage.create({ name: 'E2E Duplicate', sku: existing.sku, quantity: 5, unitPrice: 1 });

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(pharmacyPage.formError).toBeVisible();
  });

  test('rejects a non-numeric quantity', async ({ pharmacyPage }) => {
    const input = buildMedicine();

    const result = await pharmacyPage.create({ name: input.name, sku: input.sku, quantity: 'many', unitPrice: input.unitPrice });

    expect(result.status).toBeGreaterThanOrEqual(400);
    await expect(pharmacyPage.formError).toBeVisible();
  });

  test('checks quantity: the list shows the stock level of each medicine', async ({ pharmacyPage, data }) => {
    const [plenty, few] = [await data.medicine({ quantity: 500 }), await data.medicine({ quantity: 3 })];

    await pharmacyPage.refresh();

    await pharmacyPage.expectRow(plenty.id, { quantity: 500 });
    await pharmacyPage.expectRow(few.id, { quantity: 3 });
  });

  test('shows the expiry date of each medicine', async ({ pharmacyPage, data }) => {
    const valid = await data.medicine({ expiryDate: dateOnly(400) });
    const expired = await data.medicine({ expiryDate: dateOnly(-15) });
    const noExpiry = await data.medicine({ expiryDate: undefined });

    await pharmacyPage.refresh();

    await pharmacyPage.expectRow(valid.id, { expiryDate: dateOnly(400) });
    await pharmacyPage.expectRow(expired.id, { expiryDate: dateOnly(-15) });
    await expect(pharmacyPage.cell(noExpiry.id, 'expiryDate')).toHaveText('—');
  });

  test('@smoke searches medicines by name', async ({ pharmacyPage, data }) => {
    const target = await data.medicine();
    const other = await data.medicine();
    await pharmacyPage.refresh();

    const response = await pharmacyPage.search(target.name);

    expect((await response.json()).data).toHaveLength(1);
    await expect(pharmacyPage.rows).toHaveCount(1);
    await expect(pharmacyPage.rowById(target.id)).toBeVisible();
    await expect(pharmacyPage.rowById(other.id)).toHaveCount(0);
  });

  test('search matches part of a name or SKU, ignoring case', async ({ pharmacyPage, data }) => {
    const target = await data.medicine({ name: 'E2E Paracetamol Forte 650' });
    await pharmacyPage.refresh();

    await pharmacyPage.search('PARACETAMOL forte');
    await expect(pharmacyPage.rowById(target.id)).toBeVisible();

    await pharmacyPage.search(target.sku.slice(4).toUpperCase());
    await expect(pharmacyPage.rowById(target.id)).toBeVisible();
  });

  test('shows the empty state when no medicine matches, and clearing the search restores the list', async ({ pharmacyPage, data }) => {
    const medicine = await data.medicine();
    await pharmacyPage.refresh();

    await pharmacyPage.search('e2e-no-such-medicine-xyz');
    await expect(pharmacyPage.rows).toHaveCount(0);
    await expect(pharmacyPage.emptyState).toHaveText('No records found');

    await pharmacyPage.search('');
    await expect(pharmacyPage.rowById(medicine.id)).toBeVisible();
  });

  test('search treats % literally instead of as a wildcard', async ({ pharmacyPage, data }) => {
    await data.medicine();
    await pharmacyPage.refresh();

    await pharmacyPage.search('%');

    await expect(pharmacyPage.rows).toHaveCount(0);
  });
});

test.describe('Pharmacy - stock and expiry @api', () => {
  test.afterEach(async ({ data }, testInfo) => {
    await data.finish(testInfo);
  });

  test('@smoke updates stock and the new quantity is stored and shown', async ({ api, data, pharmacyPage }) => {
    const medicine = await data.medicine({ quantity: 100 });

    const response = await api.pharmacist.patch(`${endpoints.medicines}/${medicine.id}`, { quantity: 250 });

    expect(response.status()).toBe(200);
    expect((await response.json()).data).toMatchObject({ id: medicine.id, quantity: 250, sku: medicine.sku });
    expect((await api.pharmacist.getData<Medicine>(`${endpoints.medicines}/${medicine.id}`)).quantity).toBe(250);

    await pharmacyPage.open();
    await pharmacyPage.expectRow(medicine.id, { quantity: 250 });
  });

  test('dispensing reduces the stock and can trigger the low-stock condition', async ({ api, data }) => {
    const medicine = await data.medicine({ quantity: 30, reorderLevel: 20 });
    expect(isLowStock(medicine)).toBe(false);

    let current = medicine;
    for (const dispensed of [5, 5]) {
      current = await api.pharmacist.patchData<Medicine>(`${endpoints.medicines}/${medicine.id}`, { quantity: current.quantity - dispensed });
    }

    expect(current.quantity).toBe(20);
    expect(isLowStock(current)).toBe(true); // at the reorder level
  });

  test('reorder level defaults to 10 and quantity defaults to 0', async ({ api }) => {
    const input = buildMedicine();
    const created = await api.pharmacist.postData<Medicine>(endpoints.medicines, { name: input.name, sku: input.sku, unitPrice: '3.00' });
    expect(created).toMatchObject({ quantity: 0, reorderLevel: 10, expiryDate: null });
  });

  test('verifies expiry information: valid, expiring soon and expired', async ({ api, data }) => {
    const valid = await data.medicine({ expiryDate: dateOnly(365) });
    const soon = await data.medicine({ expiryDate: dateOnly(20) });
    const expired = await data.medicine({ expiryDate: dateOnly(-1) });

    const stored = await Promise.all([valid, soon, expired].map((m) => api.pharmacist.getData<Medicine>(`${endpoints.medicines}/${m.id}`)));

    for (const medicine of stored) expect(medicine.expiryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stored.map((m) => isExpired(m))).toEqual([false, false, true]);
    const in30Days = dateOnly(30);
    expect(stored.filter((m) => !isExpired(m) && m.expiryDate! <= in30Days).map((m) => m.id)).toEqual([soon.id]);
  });

  test('changing the expiry date is reflected immediately', async ({ api, data }) => {
    const medicine = await data.medicine({ expiryDate: dateOnly(10) });
    const newDate = dateOnly(500);

    const updated = await api.pharmacist.patchData<Medicine>(`${endpoints.medicines}/${medicine.id}`, { expiryDate: newDate });

    expect(updated.expiryDate).toBe(newDate);
  });

  test('rejects a non-numeric unit price', async ({ api }) => {
    const input = buildMedicine();
    const response = await api.pharmacist.post(endpoints.medicines, { name: input.name, sku: input.sku, quantity: 1, unitPrice: 'free' });
    expect(response.ok()).toBe(false);
  });

  test('list API returns quantity as a number and price as a 2-decimal string', async ({ api, data }) => {
    const medicine = await data.medicine({ unitPrice: '7.5' });
    const listed = (await api.pharmacist.list<Medicine>(endpoints.medicines)).find((m) => m.id === medicine.id)!;
    expect(typeof listed.quantity).toBe('number');
    expect(listed.unitPrice).toBe('7.50');
  });
});
