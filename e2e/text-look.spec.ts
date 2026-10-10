import { expect, test, type Page } from '@playwright/test';
import { addBlock, choose, openSection } from './helpers';

// Effects of a text (Plan.md F3): shadow and band behind the lines from the short menu, line height in the inspector.

test.use({ viewport: { width: 1440, height: 900 } });

async function newText(page: Page): Promise<void> {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    // A fresh slide, so nothing else stands on the stage.
    await page.getByTestId('add-slide').click();
    await addBlock(page, 'text');
}

const drawn = (page: Page) => page.locator('.editor-stage .block--text [data-testid="text-inner"]');

test('shadow and band behind the lines come from the short menu', async ({ page }) => {
    await newText(page);
    const menu = page.getByTestId('quick-menu');
    await expect(drawn(page).locator('.highlight')).toHaveCount(0);

    await menu.getByTestId('quick-chip').and(page.getByLabel(/^Schatten/)).click();
    await choose(page.getByTestId('quick-popover'), 'text-shadow', 'strong');
    await expect(page.locator('.editor-stage .block--text .text')).toHaveCSS('text-shadow', /rgba\(.*0\.8\)/);

    await menu.getByTestId('text-highlight').check({ force: true });
    const band = drawn(page).locator('.highlight');
    await expect(band).toHaveCount(1);
    await expect(band).toHaveCSS('background-color', /rgba\(.*0\.8\)/);
    await expect(band).toHaveCSS('padding-left', /^[1-9]/);

    // Off again: the field goes, the span with it.
    await menu.getByTestId('text-highlight').uncheck({ force: true });
    await expect(drawn(page).locator('.highlight')).toHaveCount(0);
});

test('the line height in the inspector changes the drawn text', async ({ page }) => {
    await newText(page);
    const text = page.locator('.editor-stage .block--text .text');
    await openSection(page, 'font');
    const inspector = page.getByTestId('block-inspector');
    await choose(inspector, 'text-line-height', 'loose');
    await expect(text).toHaveCSS('line-height', /^153\.6/);
    await choose(inspector, 'text-letter-spacing', 'wide');
    await expect(text).toHaveCSS('letter-spacing', /^[1-9]/);
    await choose(inspector, 'text-line-height', 'normal');
    await expect(text).not.toHaveCSS('line-height', /^153\.6/);
});
