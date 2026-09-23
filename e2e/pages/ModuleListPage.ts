import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';
import type { NavItem } from './components/AppShell';

export interface CreateResult {
  response: Response;
  status: number;
  /** Parsed JSON body of the POST response. */
  body: { success: boolean; data?: { id: number } & Record<string, unknown>; message?: string };
}

/**
 * Every module screen (patients, doctors, ...) shares one generic layout: title, search box,
 * data table and an "Add new" modal. Concrete pages only declare their route, endpoint and
 * form fields.
 */
export abstract class ModuleListPage<TForm extends object> extends BasePage {
  abstract readonly path: string;
  /** Path of the list endpoint, e.g. "/api/patients". */
  abstract readonly apiPath: string;
  abstract readonly title: string;
  abstract readonly navItem: NavItem;

  readonly heading: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly emptyState: Locator;
  readonly notice: Locator;
  readonly form: Locator;
  readonly formError: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByTestId('module-title');
    this.addButton = page.getByTestId('add-new-button');
    this.searchInput = page.getByTestId('search-input');
    this.table = page.getByTestId('data-table');
    this.rows = page.getByTestId('table-row');
    this.emptyState = page.getByTestId('empty-state');
    this.notice = page.getByTestId('notice-success');
    this.form = page.getByTestId('record-form');
    this.formError = page.getByTestId('form-error');
    this.submitButton = page.getByTestId('record-submit');
    this.cancelButton = page.getByTestId('record-cancel');
  }

  private isListResponse = (r: Response): boolean =>
    r.request().method() === 'GET' && new URL(r.url()).pathname === this.apiPath;

  private isCreateResponse = (r: Response): boolean =>
    r.request().method() === 'POST' && new URL(r.url()).pathname === this.apiPath;

  /** Loads the page by URL and waits for the list request (fresh data from the API). */
  async open(): Promise<Response> {
    const [response] = await Promise.all([this.page.waitForResponse(this.isListResponse), this.page.goto(this.path)]);
    await expect(this.heading).toHaveText(this.title);
    await this.page.waitForLoadState('networkidle');
    return response;
  }

  /** Opens the module through the sidebar, as a user would. */
  async openFromSidebar(): Promise<Response> {
    const [response] = await Promise.all([this.page.waitForResponse(this.isListResponse), this.shell.goTo(this.navItem)]);
    await expect(this.heading).toHaveText(this.title);
    return response;
  }

  /** Reloads the list (use after changing data through the API). */
  async refresh(): Promise<Response> {
    const [response] = await Promise.all([this.page.waitForResponse(this.isListResponse), this.page.reload()]);
    await expect(this.heading).toHaveText(this.title);
    return response;
  }

  rowById(id: number): Locator {
    return this.page.locator(`[data-testid="table-row"][data-row-id="${id}"]`);
  }

  cell(id: number, column: string): Locator {
    return this.rowById(id).getByTestId(`cell-${column}`);
  }

  /** Asserts the given columns of a row, e.g. expectRow(5, { status: 'Completed' }). */
  async expectRow(id: number, values: Record<string, string | number>): Promise<void> {
    await expect(this.rowById(id)).toBeVisible();
    for (const [column, value] of Object.entries(values)) {
      await expect(this.cell(id, column), `column "${column}" of row #${id}`).toHaveText(String(value));
    }
  }

  async search(term: string): Promise<Response> {
    await this.searchInput.fill(term);
    // React.StrictMode double-invokes effects in dev, so the mount that put us on this screen may have
    // already fired two list requests; one can still be in flight. Matching on the "search" query param
    // (absent when term is '') keeps this from resolving on that stale, unrelated response.
    const isThisSearch = (r: Response): boolean =>
      this.isListResponse(r) && (new URL(r.url()).searchParams.get('search') ?? '') === term;
    const [response] = await Promise.all([this.page.waitForResponse(isThisSearch), this.searchInput.press('Enter')]);
    return response;
  }

  async openForm(): Promise<void> {
    await this.addButton.click();
    await expect(this.form).toBeVisible();
  }

  field(name: keyof TForm & string): Locator {
    return this.page.getByTestId(`field-${name}`);
  }

  async fillForm(values: TForm): Promise<void> {
    for (const [name, value] of Object.entries(values)) {
      await this.page.getByTestId(`field-${name}`).fill(String(value));
    }
  }

  /** Clicks "Save record" and returns the POST response (resolves for 2xx and error statuses alike). */
  async submitForm(): Promise<CreateResult> {
    const [response] = await Promise.all([this.page.waitForResponse(this.isCreateResponse), this.submitButton.click()]);
    return { response, status: response.status(), body: await response.json() };
  }

  /** Opens the form, fills it, saves. On success the modal closes and the notice appears. */
  async create(values: TForm): Promise<CreateResult> {
    await this.openForm();
    await this.fillForm(values);
    return this.submitForm();
  }

  /** Whether the browser's native validation currently blocks submission of a form field. */
  async isFieldInvalid(name: keyof TForm & string): Promise<boolean> {
    return this.field(name).evaluate((el) => !(el as HTMLInputElement).checkValidity());
  }
}
