import { expect, test, type Page } from '@playwright/test';
import { addBlock, openSection } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/** Two named colours on the Design page, saved. */
async function makePalette(page: Page): Promise<void> {
    await page.goto('design');
    const entries = page.getByTestId('palette-entry');
    await expect(page.getByTestId('theme-accent')).toBeVisible();
    await expect(entries).toHaveCount(0);
    for (const [i, [name, hex]] of [['Gemeindeblau', '#1d4ed8'], ['Sonnengelb', '#f5b301']].entries()) {
        await page.getByTestId('palette-add').click();
        await expect(entries).toHaveCount(i + 1);
        await entries.nth(i).getByTestId('palette-name').fill(name!);
        const color = entries.nth(i).locator('input.hex');
        await color.fill(hex!);
        await color.blur();
    }
    await page.getByTestId('theme-save').click();
    await expect(page.getByTestId('theme-saved')).toBeVisible();
}

test('the Design page keeps a palette, in order, and shows no swatches itself', async ({ page }) => {
    await makePalette(page);
    await expect(page.getByTestId('theme-accent-swatch')).toHaveCount(0);
    await expect(page.locator('.palette-swatches')).toHaveCount(0);

    await page.reload();
    const names = page.getByTestId('palette-name');
    await expect(names.nth(0)).toHaveValue('Gemeindeblau');
    await expect(names.nth(1)).toHaveValue('Sonnengelb');

    await page.getByTestId('palette-down').first().click();
    await expect(names.nth(0)).toHaveValue('Sonnengelb');
    await page.getByTestId('palette-remove').first().click();
    await expect(page.getByTestId('palette-entry')).toHaveCount(1);
    await expect(names.first()).toHaveValue('Gemeindeblau');

    for (let i = 0; i < 11; i++) await page.getByTestId('palette-add').click();
    await expect(page.getByTestId('palette-entry')).toHaveCount(12);
    await expect(page.getByTestId('palette-add')).toBeDisabled();
});

test('a swatch sets the hex value of a text colour and of a fill (Plan.md 64)', async ({ page }) => {
    await makePalette(page);
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'text');
    await page.getByTestId('text-input').fill('Farbprobe');

    await openSection(page, 'font');
    await expect(page.getByTestId('text-color-swatch')).toHaveCount(5);
    await page.getByRole('button', { name: 'Sonnengelb (#F5B301)' }).first().click();
    await expect(page.getByTestId('text-color')).toHaveValue('#f5b301');
    await expect(page.getByTestId('text-color-swatch').nth(4)).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('slide-item').nth(2).click();
    await openSection(page, 'background');
    await page.getByTestId('fill-color-swatch').nth(3).click();
    await expect(page.getByTestId('fill-color')).toHaveValue('#1d4ed8');
});

test('without a palette the three colours of the design stand as swatches', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await addBlock(page, 'text');
    await openSection(page, 'font');
    const swatches = page.getByTestId('text-color-swatch');
    await expect(swatches).toHaveCount(3);
    await expect(swatches.nth(0)).toHaveAttribute('title', 'Akzent (#3B82F6)');
    await expect(swatches.nth(1)).toHaveAttribute('title', 'Text (#FFFFFF)');
    await expect(swatches.nth(2)).toHaveAttribute('title', 'Hintergrund (#1E293B)');
    await swatches.nth(2).click();
    await expect(page.getByTestId('text-color')).toHaveValue('#1e293b');
});
