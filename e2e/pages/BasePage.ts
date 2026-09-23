import { Page } from '@playwright/test';
import { AppShell } from './components/AppShell';

export abstract class BasePage {
  readonly shell: AppShell;

  constructor(protected readonly page: Page) {
    this.shell = new AppShell(page);
  }

  /** Navigates and waits until the network is quiet (initial data loaded). */
  protected async navigate(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }
}
