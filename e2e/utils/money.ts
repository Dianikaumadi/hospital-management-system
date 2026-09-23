export interface InvoiceLine { description: string; quantity: number; unitPrice: number }

/** Sum of quantity x unit price, rounded to cents (avoids float drift such as 0.1 + 0.2). */
export const calcInvoiceTotal = (items: InvoiceLine[]): number =>
  Math.round(items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) * 100) / 100;

/** "₹1,234.5" -> 1234.5 */
export const parseCurrency = (text: string): number => Number(text.replace(/[^0-9.-]/g, ''));
