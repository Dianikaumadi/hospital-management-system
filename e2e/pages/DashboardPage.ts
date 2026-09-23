import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';
import { parseCurrency } from '../utils/money';
import type { DashboardStats } from '../api/types';

const isDashboardRequest = (r: Response): boolean => r.url().endsWith('/api/reports/dashboard') && r.request().method() === 'GET';

export class DashboardPage extends BasePage {
  readonly title: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.getByTestId('dashboard-title');
  }

  /** Opens "/" and waits for the stats request, returning its response. */
  async open(): Promise<Response> {
    const [response] = await Promise.all([this.page.waitForResponse(isDashboardRequest), this.page.goto('/')]);
    await this.waitForStats();
    return response;
  }

  async waitForStats(): Promise<void> {
    await expect(this.title).toBeVisible();
    await expect(this.page.getByTestId('stat-patients')).toBeVisible(); // skeleton cards are replaced
  }

  /** Reads all six dashboard figures as numbers. */
  async readStats(): Promise<DashboardStats> {
    const num = async (testId: string): Promise<number> => parseCurrency((await this.page.getByTestId(testId).innerText()).trim());
    return {
      patients: await num('stat-patients-value'),
      appointments: await num('stat-appointments-value'),
      revenue: await num('stat-revenue-value'),
      labTests: await num('stat-lab-tests-value'),
      medicines: await num('summary-medicines-value'),
      staff: await num('summary-staff-value')
    };
  }

  statValue(key: 'patients' | 'appointments' | 'revenue' | 'lab-tests'): Locator {
    return this.page.getByTestId(`stat-${key}-value`);
  }
  summaryValue(key: 'medicines' | 'staff' | 'lab-tests' | 'appointments'): Locator {
    return this.page.getByTestId(`summary-${key}-value`);
  }
}
