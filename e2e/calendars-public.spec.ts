import { expect, test } from '@playwright/test';
import { isAnonymous, openSection } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Only public calendars are on offer (Plan.md 73): those `GET /api/calendars` lists without sign-in. ChurchTools'
 * answers are made up here: the demo's list block already has the calendars 1, 2 and 3 – and 3 is not public.
 * Nothing of this reaches the instance.
 */
test('the inspector offers no calendar that is not public, and names one the block has already', async ({ page }) => {
    const one = { id: 1, name: 'Sonstige Veranstaltung' };
    const two = { id: 2, name: 'Gottesdienst' };
    await page.route(/\/api\/calendars(\?|$)/, (route) =>
        route.fulfill({
            json: { data: isAnonymous(route.request()) ? [one, two] : [one, two, { id: 3, name: 'Gemeindeleitung' }] },
        }),
    );
    await page.route(/\/api\/calendars\/appointments/, (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('slide-item').nth(2).click();
    await page.getByTestId('frame-appointment-list').first().click();

    const inspector = page.getByTestId('block-inspector');
    await openSection(page, 'calendars');
    await inspector.getByRole('button', { name: 'Erklärung' }).click();
    await expect(inspector.getByText('Zur Wahl stehen nur öffentliche Kalender.')).toBeVisible();
    await expect(inspector.getByRole('switch', { name: 'Gottesdienst' })).toBeChecked();
    await expect(inspector.getByRole('switch', { name: 'Gemeindeleitung' })).toHaveCount(0);

    const hidden = inspector.getByTestId('hidden-calendar-3');
    await expect(hidden).toContainText('Gemeindeleitung – nicht öffentlich, erscheint auf keinem Fernseher');
    await hidden.getByRole('button', { name: 'Entfernen' }).click();
    await expect(hidden).toHaveCount(0);
    await expect(page.getByTestId('save-status')).toHaveText('Ungespeicherte Änderungen');
});

test('the inspector says so, with the way to release one, when no calendar is public', async ({ page }) => {
    await page.route(/\/api\/calendars(\?|$)/, (route) =>
        route.fulfill({ json: { data: isAnonymous(route.request()) ? [] : [{ id: 1, name: 'Sonstige Veranstaltung' }] } }),
    );
    await page.route(/\/api\/calendars\/appointments/, (route) => route.fulfill({ json: { data: [] } }));

    await page.goto('./');
    await page.getByTestId('open-editor').first().click();
    await page.getByTestId('slide-item').nth(2).click();
    await page.getByTestId('frame-appointment-list').first().click();

    const inspector = page.getByTestId('block-inspector');
    await expect(inspector.getByText('Kein Kalender ist öffentlich.')).toBeVisible();
    await expect(inspector.getByTestId('no-public-calendars')).toContainText(
        'Berechtigungen → Benutzer → „Öffentlicher Benutzer" → Kalender → „Einzelnen Kalender sehen"',
    );
});
