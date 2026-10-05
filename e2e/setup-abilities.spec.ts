import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

/**
 * Plan.md 63: without group rights the buttons of the assistant are greyed out and say what is missing.
 * Demo mode has no groups the assistant created, so the demo store gets a settings document that lists two;
 * `/permissions/global` is the real answer with the section `churchgroup` replaced. Nothing is written to the instance.
 */
async function withCreatedGroups(page: Page): Promise<void> {
    await page.goto('./'); // seeds the demo store
    await page.evaluate(() => {
        const key = 'infoscreen-designer.demo-store';
        const state = JSON.parse(localStorage.getItem(key)!) as {
            nextId: number;
            categories: { id: number; shorty: string }[];
            values: [number, { id: number; value: string }[]][];
        };
        const category = state.categories.find((c) => c.shorty === 'settings')!;
        const schema = (JSON.parse(state.values.flatMap(([, list]) => list)[0]!.value) as { schema: unknown }).schema;
        let entry = state.values.find(([id]) => id === category.id);
        if (!entry) state.values.push((entry = [category.id, []]));
        entry[1].push({ id: state.nextId++, value: JSON.stringify({ schema, id: 'settings', kind: 'settings', createdGroupIds: [25, 28] }) });
        localStorage.setItem(key, JSON.stringify(state));
    });
}

async function answerGroupRights(page: Page, churchgroup: Record<string, unknown>): Promise<void> {
    await page.route('**/api/permissions/global', async (route) => {
        const response = await route.fetch();
        const body = (await response.json()) as { data: Record<string, unknown> };
        body.data.churchgroup = churchgroup;
        await route.fulfill({ response, json: body });
    });
}

test('without group rights the buttons are greyed out and name what is missing', async ({ page }) => {
    await answerGroupRights(page, {});
    await withCreatedGroups(page);
    await page.goto('./einstellungen/gruppen');
    await expect(page.getByTestId('update-rights')).toBeDisabled();
    await expect(page.getByTestId('remove-setup')).toBeDisabled();
    await expect(page.getByTestId('ability-hint-refresh')).toContainText('Gruppe inkl. ihrer Gruppenmitglieder sehen');
    await expect(page.getByTestId('ability-hint-remove')).toContainText('Gruppe löschen');
    await expect(page.getByTestId('ability-hint-remove')).toContainText('Gruppen verwalten');
});

test('"Gruppen verwalten" greys out nothing', async ({ page }) => {
    await answerGroupRights(page, { 'administer groups': true });
    await withCreatedGroups(page);
    await page.goto('./einstellungen/gruppen');
    await expect(page.getByTestId('remove-setup')).toBeEnabled();
    await expect(page.getByTestId('ability-hint-refresh')).toHaveCount(0);
    await expect(page.getByTestId('ability-hint-remove')).toHaveCount(0);
});

/** Plan.md 71: the group type of the assistant is chosen, not assumed. `/group/grouptypes` is answered here, nothing is written. */
async function answerGroupTypes(page: Page, names: string[]): Promise<void> {
    await page.route('**/api/group/grouptypes', (route) =>
        route.fulfill({ json: { data: names.map((name, i) => ({ id: i + 1, name, sortKey: i })) } }),
    );
}

test('the group type is preselected with „Merkmal"', async ({ page }) => {
    await answerGroupTypes(page, ['Kleingruppe', 'Dienst', 'Merkmal']);
    await page.goto('./einstellungen/gruppen');
    const select = page.getByTestId('group-type');
    await expect(select.locator('option')).toHaveText(['Kleingruppe', 'Dienst', 'Merkmal']);
    await expect(select.locator('option:checked')).toHaveText('Merkmal');
});

test('without „Merkmal" nothing is preselected until a type is chosen', async ({ page }) => {
    await answerGroupTypes(page, ['Kleingruppe', 'Dienst']);
    await page.goto('./einstellungen/gruppen');
    const select = page.getByTestId('group-type');
    await expect(select.locator('option:checked')).toHaveText('– bitte wählen –');
    await expect(page.getByTestId('run-assistant')).toBeDisabled();
    await select.selectOption({ label: 'Dienst' });
    await expect(select.locator('option:checked')).toHaveText('Dienst');
    await expect(select.locator('option')).toHaveText(['Kleingruppe', 'Dienst']);
});
