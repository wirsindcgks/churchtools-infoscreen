import { expect, test, type Page } from '@playwright/test';
import { expectSlides, openInspector } from './helpers';

// Templates (Plan.md 87): blocks saved once, standing on many slides, changed in one place – in demo mode.
test.use({ viewport: { width: 1440, height: 900 } });

const frame = (page: Page, id: string) => page.locator(`.frame[data-block-id="${id}"]`);

async function openFirstPlaylist(page: Page): Promise<void> {
    await page.goto('playlists');
    await page.getByTestId('playlist-card').first().getByTestId('open-playlist').click();
    await expectSlides(page);
}

/** The two texts of the first demo slide become the template "Kopf"; the slide then holds one template block. */
async function makeTemplate(page: Page): Promise<void> {
    await openFirstPlaylist(page);
    await frame(page, 'welcome').click();
    await frame(page, 'welcome-sub').click({ modifiers: ['Shift'] });
    await page.getByTestId('quick-more').click();
    await page.getByTestId('quick-save-template').click();
    await expect(page.getByTestId('template-name-dialog')).toBeVisible();
    await page.getByTestId('template-name').fill('Kopf');
    await page.getByTestId('template-name-save').click();
    await expect(page.getByTestId('template-name-dialog')).toHaveCount(0);
    await expect(page.getByTestId('frame-template')).toHaveCount(1);
    await expect(page.getByTestId('frame-text')).toHaveCount(0);
}

const position = (page: Page) =>
    page.getByTestId('frame-template').evaluate((el) => `${(el as HTMLElement).style.left} ${(el as HTMLElement).style.top}`);

test('blocks saved as a template become one template block, and the template stands on a second slide at the same place', async ({ page }) => {
    await makeTemplate(page);
    await expect(page.getByTestId('block-inspector')).toContainText('Vorlage: Kopf');
    await expect(page.getByTestId('slide-item').first()).toContainText('Herzlich willkommen!');
    const first = await position(page);

    await page.getByTestId('slide-item').nth(1).click();
    await expect(page.getByTestId('frame-template')).toHaveCount(0);
    await page.getByTestId('add-block-menu').click();
    await page.getByTestId('sheet-add-template').click();
    await expect(page.getByTestId('frame-template')).toHaveCount(1);
    expect(await position(page)).toBe(first);
    await expect(page.getByTestId('slide-item').nth(1)).toContainText('Herzlich willkommen!');
});

test('editing the template changes it on both slides at once', async ({ page }) => {
    await makeTemplate(page);
    await page.getByTestId('slide-item').nth(1).click();
    await page.getByTestId('add-block-menu').click();
    await page.getByTestId('sheet-add-template').click();

    await openInspector(page);
    await page.getByTestId('template-edit').click();
    await expect(page.getByTestId('template-edit-bar')).toContainText('Vorlage Kopf – auf 2 Folien');
    await expect(page.getByTestId('template-frame')).toBeVisible();
    // The slides are out of reach while it lasts.
    await expect(page.getByTestId('save')).toBeDisabled();

    await frame(page, 'welcome').click();
    await page.getByTestId('text-input').fill('Neuer Titel');
    await page.getByTestId('template-edit-done').click();
    await expect(page.getByTestId('template-edit-bar')).toHaveCount(0);

    await expect(page.getByTestId('slide-item').nth(1)).toContainText('Neuer Titel');
    await page.getByTestId('slide-item').first().click();
    await expect(page.getByTestId('slide-item').first()).toContainText('Neuer Titel');
    await expect(page.getByTestId('slide-item').first()).not.toContainText('Herzlich willkommen!');
});

test('cancelling throws the changes away', async ({ page }) => {
    await makeTemplate(page);
    await openInspector(page);
    await page.getByTestId('template-edit').click();
    await frame(page, 'welcome').click();
    await page.getByTestId('text-input').fill('Verworfen');
    await page.getByTestId('template-edit-cancel').click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('template-edit-bar')).toHaveCount(0);
    await expect(page.getByTestId('slide-item').first()).toContainText('Herzlich willkommen!');
    await expect(page.getByTestId('slide-item').first()).not.toContainText('Verworfen');
    await expect(page.getByTestId('frame-template')).toHaveCount(1);
});

test('dissolving makes blocks of the slide\'s own again', async ({ page }) => {
    await makeTemplate(page);
    await openInspector(page);
    await page.getByTestId('template-unlink').click();
    await expect(page.getByTestId('frame-template')).toHaveCount(0);
    await expect(page.getByTestId('frame-text')).toHaveCount(2);
    await expect(page.getByTestId('slide-item').first()).toContainText('Herzlich willkommen!');
});

test('a template that stands on a presentation cannot be deleted on the page "Design"', async ({ page }) => {
    await makeTemplate(page);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');
    await page.getByTestId('leave-editor').click();
    await page.getByTestId('sidebar-design').click();
    const row = page.getByTestId('template-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Kopf');
    await expect(row.getByTestId('template-row-uses')).toHaveText('auf 1 Folie');

    await row.getByTestId('template-delete').click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('confirm-dialog')).toContainText('Diese Vorlage steckt noch in:');
    await page.getByTestId('confirm-ok').click();
    await expect(row).toHaveCount(1);

    await row.getByTestId('template-rename').click();
    await page.getByTestId('template-name').fill('Seitenkopf');
    await page.getByTestId('template-name-save').click();
    await expect(row.getByTestId('template-row-name')).toHaveText('Seitenkopf');
});

test('a template made of locked blocks comes in on another slide at its place and locked; dissolving frees the blocks', async ({ page }) => {
    await openFirstPlaylist(page);
    await frame(page, 'welcome').click();
    await frame(page, 'welcome-sub').click({ modifiers: ['Shift'] });
    await page.getByTestId('quick-lock').click();
    await page.getByTestId('quick-more').click();
    await page.getByTestId('quick-save-template').click();
    await page.getByTestId('template-name').fill('Fest');
    await page.getByTestId('template-name-save').click();
    await expect(page.getByTestId('frame-template')).toHaveCount(1);
    await expect(page.locator('.frame--locked')).toHaveCount(1);
    const first = await position(page);
    // The lock cannot be taken off: the button stays, disabled.
    await expect(page.getByTestId('quick-lock')).toBeDisabled();

    await page.getByTestId('slide-item').nth(1).click();
    await page.getByTestId('add-block-menu').click();
    await page.getByTestId('sheet-add-template').click();
    expect(await position(page)).toBe(first);
    await expect(page.locator('.frame--locked')).toHaveCount(1);
    await expect(page.getByTestId('quick-lock')).toBeDisabled();

    await page.getByTestId('quick-more').click();
    await page.getByTestId('quick-template-unlink').click();
    await expect(page.getByTestId('frame-template')).toHaveCount(0);
    await expect(page.getByTestId('frame-text')).toHaveCount(2);
    await expect(page.locator('.frame--locked')).toHaveCount(0);
});

test('a template is edited from the page "Design" and the change stands on the slide', async ({ page }) => {
    await makeTemplate(page);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');
    await page.getByTestId('leave-editor').click();
    await page.getByTestId('sidebar-design').click();

    await page.getByTestId('template-row').getByTestId('template-open').click();
    await expect(page.getByTestId('template-edit-bar')).toContainText('Vorlage Kopf');
    await expect(page.getByTestId('leave-editor')).toContainText('Design');
    // No slides, no publishing.
    await expect(page.getByTestId('slide-item')).toHaveCount(0);
    await expect(page.getByTestId('save')).toHaveCount(0);
    await frame(page, 'welcome').click();
    await page.getByTestId('text-input').fill('Von der Seite Design');
    await page.getByTestId('template-edit-done').click();
    await expect(page).toHaveURL(/\/design$/);
    await expect(page.getByTestId('template-row')).toHaveCount(1);

    await page.getByTestId('sidebar-playlists').click();
    await page.getByTestId('playlist-card').first().getByTestId('open-playlist').click();
    await expectSlides(page);
    await expect(page.getByTestId('slide-item').first()).toContainText('Von der Seite Design');
});

test('cancelling on the template page asks about changes and returns to "Design"', async ({ page }) => {
    await makeTemplate(page);
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');
    await page.getByTestId('leave-editor').click();
    await page.getByTestId('sidebar-design').click();
    await page.getByTestId('template-row').getByTestId('template-open').click();
    await frame(page, 'welcome').click();
    await page.getByTestId('text-input').fill('Verworfen');
    await page.getByTestId('template-edit-cancel').click();
    await page.getByTestId('confirm-ok').click();
    await expect(page).toHaveURL(/\/design$/);
    await expect(page.getByTestId('template-row')).toHaveCount(1);
});
