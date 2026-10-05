import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Only public calendars are on offer (Plan.md 62). ChurchTools' answers are made up here, in the shape of
 * `GET /api/calendars`: the demo's list block already has the calendars 1, 2 and 3 – and 3 is not public.
 * Nothing of this reaches the instance.
 */
test('the inspector offers no calendar that is not public, and names one the block has already', async ({ page }) => {
    await page.route(/\/api\/calendars(\?|$)/, (route) =>
        route.fulfill({
            json: {
                data: [
                    { id: 1, name: 'Sonstige Veranstaltung', isPublic: true },
                    { id: 2, name: 'Gottesdienst', isPublic: true },
                    { id: 3, name: 'Gemeindeleitung', isPublic: false },
                ],
            },
        }),
    );
    await page.route(/\/api\/calendars\/appointments/, (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('slide-item').nth(2).click();
    await page.getByTestId('frame-appointment-list').first().click();

    const inspector = page.getByTestId('block-inspector');
    await expect(inspector.getByText('Zur Wahl stehen nur öffentliche Kalender.')).toBeVisible();
    await expect(inspector.getByRole('checkbox', { name: 'Gottesdienst' })).toBeChecked();
    await expect(inspector.getByRole('checkbox', { name: 'Gemeindeleitung' })).toHaveCount(0);

    const hidden = inspector.getByTestId('hidden-calendar-3');
    await expect(hidden).toContainText('Gemeindeleitung – nicht öffentlich, erscheint auf keinem Fernseher');
    await hidden.getByRole('button', { name: 'Entfernen' }).click();
    await expect(hidden).toHaveCount(0);
    await expect(page.getByTestId('save-status')).toHaveText('Ungespeicherte Änderungen');
});
