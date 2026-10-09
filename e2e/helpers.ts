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

/** The sortable row (`useSortable`) a handle or any part of it belongs to. */
export function sortRow(part: Locator): Locator {
    return part.locator('xpath=ancestor-or-self::*[@data-sort-item][1]');
}

/** Moves a sortable row by one place with the keyboard: its handle takes the focus, the arrow key does the rest. */
export async function nudgeRow(handle: Locator, key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): Promise<void> {
    await handle.focus();
    await handle.press(key);
}

/**
 * Drags a sortable row by its handle (the mouse takes the handle at once) until its centre has passed the centre of
 * `target`, in steps so the list follows; `horizontal` for the phone's row of slides, where the tile itself is grabbed.
 */
export async function dragRow(page: Page, grip: Locator, target: Locator, horizontal = false): Promise<void> {
    const from = (await grip.boundingBox())!;
    const own = (await sortRow(grip).boundingBox())!;
    const over = (await sortRow(target).boundingBox())!;
    const axis = horizontal ? 'x' : 'y';
    const size = horizontal ? 'width' : 'height';
    const delta = over[axis] + over[size] / 2 - (own[axis] + own[size] / 2);
    // A few pixels beyond the other's centre, in the direction of the drag.
    const reach = delta + Math.sign(delta) * 6;
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + (horizontal ? reach : 0), start.y + (horizontal ? 0 : reach), { steps: 12 });
    await page.mouse.up();
}
