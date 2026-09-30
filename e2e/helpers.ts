import { expect, type Page } from '@playwright/test';

/** Adds a block through the "+ Baustein" sheet, the only way since Plan.md 47. */
export async function addBlock(page: Page, type: string): Promise<void> {
    await page.getByTestId('add-block-menu').click();
    await page.getByTestId(`sheet-add-${type}`).click();
    await expect(page.getByTestId('block-sheet')).toHaveCount(0);
}

/** Unfolds an inspector section unless it stands open already (they remember their state). */
export async function openSection(page: Page, id: string): Promise<void> {
    const section = page.getByTestId(`section-${id}`);
    if ((await section.getAttribute('open')) === null) await page.getByTestId(`section-${id}-toggle`).click();
    await expect(section).toHaveAttribute('open', '');
}
