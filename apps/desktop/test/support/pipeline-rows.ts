/**
 * The pipeline sidebar's step rows in the app tests: a row by its label (the row button's text
 * starts with it; the next-step card's buttons also name steps), unfolding the "N steps done"
 * line first when the row is folded away (PLAN.md#11.2).
 */
import type { Locator, Page } from 'playwright';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stageRow(page: Page, label: string): Locator {
  return page
    .getByRole('region', { name: 'Pipeline' })
    .locator('[data-stage-row] > button')
    .filter({ hasText: new RegExp(`^${escapeRegExp(label)}`) });
}

/** The row of `label`, unfolding the finished steps when it is folded away. */
export async function showStage(page: Page, label: string): Promise<Locator> {
  const row = stageRow(page, label);
  if ((await row.count()) === 0) {
    const fold = page
      .getByRole('region', { name: 'Pipeline' })
      .locator('.stage-fold-toggle[aria-expanded="false"]');
    if ((await fold.count()) > 0) await fold.click();
  }
  return row;
}

/** The row's text plus its tooltip (the detail line), for polling a step's status. */
export async function stageText(page: Page, label: string): Promise<string> {
  const row = await showStage(page, label);
  if ((await row.count()) === 0) return '';
  const text = (await row.textContent()) ?? '';
  const title = (await row.getAttribute('title')) ?? '';
  return title === '' ? text : `${text} (${title})`;
}

/** Opens the chat column when it starts as the slim rail (windows under 1400 px). */
export async function showChat(page: Page): Promise<Locator> {
  const chat = page.getByRole('region', { name: 'Claude' });
  const show = chat.getByRole('button', { name: 'Show chat' });
  if ((await show.count()) > 0) await show.click();
  return chat;
}
