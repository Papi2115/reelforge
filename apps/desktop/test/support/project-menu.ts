/**
 * The header's project menu in the app tests (docs/ux/redesign-2.4.md U4): the project title is a
 * menu button with Project settings / Open folder / Close project. Project settings shows its
 * sections in tabs (U12): `projectSettingsTab` opens one.
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

export type ProjectSettingsTab =
  'Visuals' | 'Characters' | 'Direction' | 'Scenes and checks' | 'Research' | 'Channel & genre';

/** Opens a section tab of the open Project settings dialog (Visuals is open first). */
export async function projectSettingsTab(dialog: Locator, tab: ProjectSettingsTab): Promise<void> {
  await dialog.getByRole('tab', { name: tab, exact: true }).click();
  await dialog
    .getByRole('tab', { name: tab, exact: true })
    .and(dialog.locator('[aria-selected="true"]'))
    .waitFor();
}
