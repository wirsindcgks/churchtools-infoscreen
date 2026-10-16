import { expect, test } from '@playwright/test';
import { openSection } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

const SECTIONS = ['design-colors', 'design-surfaces', 'design-font', 'design-appointments'];

test('the Design page starts with four folded sections, each with a summary, and the templates card beside them (Plan.md 89)', async ({ page }) => {
    await page.goto('design');
    await expect(page.getByTestId('design-heading')).toBeVisible();
    for (const id of SECTIONS) {
        await expect(page.getByTestId(`section-${id}`)).not.toHaveAttribute('open', '');
        await expect(page.getByTestId(`section-${id}-toggle`).locator('.summary-line')).not.toBeEmpty();
    }
    await expect(page.getByTestId('section-design-colors-toggle')).toContainText('ohne Palette');
    await expect(page.getByTestId('section-design-surfaces-toggle')).toContainText('Rund · leicht getönt');
    await expect(page.getByTestId('section-design-appointments-toggle')).toContainText('Nativ · Bilder 16:9');
    await expect(page.getByTestId('design-templates')).toBeVisible();
    await expect(page.getByTestId('theme-preview')).toBeVisible();
});

test('a change shows in the summary once the section is folded again (Plan.md 89)', async ({ page }) => {
    await page.goto('design');
    await openSection(page, 'design-surfaces');
    await page.getByTestId('corners-square').check();
    await page.getByTestId('section-design-surfaces-toggle').click();
    await expect(page.getByTestId('section-design-surfaces')).not.toHaveAttribute('open', '');
    await expect(page.getByTestId('section-design-surfaces-toggle')).toContainText('Eckig · leicht getönt');
});
