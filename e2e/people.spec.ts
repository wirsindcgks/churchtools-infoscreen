import { expect, test } from '@playwright/test';
import { addBlock, choose, chosen, openSection } from './helpers';

// The people block (Plan.md 112, Stück 1): in the demo there is no group "Infoscreen-People", so the block says so calmly
// and the inspector offers its choices; the cards themselves are covered by the unit tests (`render.test.ts`).

test.use({ viewport: { width: 1440, height: 900 } });

test('the people block says the group is not set up, and its inspector keeps its sections in order', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await page.getByTestId('add-slide').click();

    await addBlock(page, 'people');
    const block = page.locator('.editor-stage .block--people');
    await expect(block.getByTestId('people-empty')).toContainText('noch nicht eingerichtet');
    await expect(page.getByTestId('people-no-group')).toBeVisible();

    // Group first, then roles, then "Darstellung", then "Schrift" (AGENTS.md, Ordnung im Inspektor); nothing is open at the start.
    const ids = await page.locator('[data-testid^="section-"]:not([data-testid$="-toggle"])').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    const order = ['section-people-group', 'section-people-roles', 'section-appearance', 'section-font'];
    expect(ids.filter((id) => order.includes(id!))).toEqual(order);
    await expect(page.getByTestId('section-people-roles')).not.toHaveAttribute('open', '');

    await expect(page.getByTestId('section-people-group')).not.toHaveAttribute('open', '');
    // No person field is released in the demo: the inspector offers none (Stück 3).
    await expect(page.getByTestId('people-person-fields-add')).toHaveCount(0);
    await openSection(page, 'people-group');
    await expect(page.getByTestId('people-group-hint')).toBeVisible();
    await openSection(page, 'people-roles');
    await expect(page.getByTestId('people-roles-all')).toBeDisabled();

    // Only one section open at a time: "Darstellung" closes the roles.
    await openSection(page, 'appearance');
    await expect(page.getByTestId('section-people-roles')).not.toHaveAttribute('open', '');
    // Cards by default: the tile "Ansicht" is there, with columns and rows; the list takes them away (schema 1.55).
    expect(await chosen(page, 'people-layout')).toBe('card');
    await expect(page.getByTestId('people-rows')).toBeVisible();
    await choose(page, 'people-layout', 'list');
    await expect(page.locator('.editor-stage .block--people').getByTestId('people-list')).toBeVisible();
    await expect(page.getByTestId('people-columns')).toHaveCount(0);
    await expect(page.getByTestId('people-rows')).toHaveCount(0);
    await choose(page, 'people-layout', 'card');
    await choose(page, 'people-columns', '2');
    expect(await chosen(page, 'people-columns')).toBe('2');
    await page.getByTestId('people-show-image').click();
    await expect(page.getByTestId('people-show-image')).not.toBeChecked();
});
