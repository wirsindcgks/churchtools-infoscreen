import { expect, type Locator, type Page, type Request } from '@playwright/test';

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

/** Whether the module asked anonymously (`getAnonymously` marks its requests; Plan.md 73, G53). */
export function isAnonymous(request: Request): boolean {
    return request.headers()['x-infoscreen-anonymous'] === '1';
}

/**
 * Picks a value in a field of the inspector, whatever it looks like: a `<select>` takes `selectOption`, a segment or a
 * tile group (the `data-testid` stands on the group) checks the radio button with that value.
 */
export async function choose(scope: Page | Locator, testid: string, value: string): Promise<void> {
    const control = scope.getByTestId(testid);
    if ((await control.evaluate((element) => element.tagName)) === 'SELECT') await control.selectOption(value);
    else await control.locator(`input[value="${value}"]`).check();
}

/** The value a field of the inspector shows: a `<select>`'s value, or the radio button checked in a segment or tile group. */
export async function chosen(scope: Page | Locator, testid: string): Promise<string | null> {
    const control = scope.getByTestId(testid);
    if ((await control.evaluate((element) => element.tagName)) === 'SELECT') return control.inputValue();
    const checked = control.locator('input:checked');
    return (await checked.count()) ? checked.getAttribute('value') : null;
}

/** The hex field of a colour field: „Eigene Farbe" is unfolded first where it is folded (Plan.md 79, B2, design first). */
export async function customColor(scope: Page | Locator, testid: string): Promise<Locator> {
    const toggle = scope.getByTestId(`${testid}-custom`);
    if ((await toggle.count()) > 0 && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    return scope.getByTestId(testid);
}

/** Picks a font from the list of a font field by its key. */
export async function chooseFont(scope: Page | Locator, testid: string, key: string): Promise<void> {
    await scope.getByTestId(testid).click();
    await scope.getByTestId(`${testid}-${key}`).click();
}
