/**
 * The header's project menu in the app tests (docs/ux/redesign-2.4.md U4): the project title is a
 * menu button with Project settings / Open folder / Close project.
 */
import type { Locator, Page } from 'playwright';

export type ProjectMenuItem = 'Project settings' | 'Open folder' | 'Close project';

/** The project title button (present while a project is open). */
export function projectMenuButton(page: Page): Locator {
  return page.locator('header button.project-title');
}

/** Opens the project menu and picks `item`. */
export async function projectMenu(page: Page, item: ProjectMenuItem): Promise<void> {
  await projectMenuButton(page).click();
  await page.getByRole('menu', { name: 'Project' }).getByRole('menuitem', { name: item }).click();
}
