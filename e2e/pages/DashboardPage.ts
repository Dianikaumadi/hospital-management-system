import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';
import { parseCurrency } from '../utils/money';
import type { DashboardStats } from '../api/types';

// Admins load the hospital-wide report; every other role loads its own overview (with a ?from=&to= day window).
const isDashboardRequest = (r: Response): boolean =>
  r.request().method() === 'GET' && ['/api/reports/dashboard', '/api/reports/overview'].includes(new URL(r.url()).pathname);

export class DashboardPage extends BasePage {
  readonly title: Locator;
  /** Container of the role-specific dashboard (non-admin roles). */
  readonly roleDashboard: Locator;
  /** Rows of the role dashboard's work list (today's appointments, test queue, reorder list, ...). */
  readonly overviewItems: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.getByTestId('dashboard-title');
    this.roleDashboard = page.getByTestId('role-dashboard');
    this.overviewItems = page.getByTestId('overview-item');
  }

  /** Opens "/" and waits for the stats request, returning its response. */
  async open(): Promise<Response> {
    const [response] = await Promise.all([this.page.waitForResponse(isDashboardRequest), this.page.goto('/')]);
    await this.waitForStats();
    return response;
  }

  async waitForStats(): Promise<void> {
    await expect(this.title).toBeVisible();
    // Skeleton cards are replaced by real ones (any stat card: the set differs per role).
    await expect(this.page.locator('[data-testid^="stat-"][data-testid$="-value"]').first()).toBeVisible();
  }

  /** A role-dashboard card, by the key the overview API returns (e.g. "low-stock"). */
  card(key: string): Locator {
    return this.page.getByTestId(`stat-${key}`);
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
