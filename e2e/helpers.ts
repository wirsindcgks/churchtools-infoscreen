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

/**
 * Opens the big sheet of the inspector on a phone (Plan.md 79, C2): with a block chosen through "⋯ → Alle Einstellungen" of its
 * bar, else through "⋯ → Folie bearbeiten" of the slide's bar. The sheet does not open by itself there any more.
 */
export async function openInspector(page: Page): Promise<void> {
    const sheet = page.getByTestId('inspector-sheet');
    if (await sheet.evaluate((element) => element.classList.contains('open'))) return;
    const bar = page.getByTestId('phone-bar');
    if (await bar.getByTestId('quick-menu').count()) {
        await bar.getByTestId('quick-more').click();
        await bar.getByTestId('quick-all-settings').click();
    } else {
        await bar.getByTestId('phone-slide-more').click();
        await page.getByTestId('phone-slide-edit').click();
    }
    await expect(sheet).toHaveClass(/open/);
}

/** Opens the sheet of slides on a phone ("Folie 2 von 5" in the bar); a tap on a slide in it chooses it and closes it. */
export async function openSlides(page: Page): Promise<Locator> {
    await page.getByTestId('phone-slides').click();
    const sheet = page.getByTestId('slides-sheet');
    await expect(sheet).toBeVisible();
    return sheet;
}

/** The editor stands with its slides: three in the list, or "Folie 1 von 3" in the bar of a phone, where the list is a sheet. */
export async function expectSlides(page: Page, count = 3): Promise<void> {
    const phone = page.getByTestId('phone-slides');
    await expect(page.getByTestId('slide-item').first().or(phone)).toBeAttached();
    if (await phone.count()) await expect(phone).toContainText(`von ${count}`);
    else await expect(page.getByTestId('slide-item')).toHaveCount(count);
}

/** On a phone the inspector is a sheet that opens on request (Plan.md 79, C2); elsewhere it is there or opens by itself. */
export async function openInspectorOnPhone(page: Page): Promise<void> {
    if (await page.getByTestId('phone-bar').count()) await openInspector(page);
}
