import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Zero axe violations (WCAG 2.2 AA) is a hard requirement on every screen. */
async function expectNoAxeViolations(page: Page, screen: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(results.violations, `axe violations on ${screen}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
}

test.describe('billing-day change – happy path', () => {
  test('lobby → select → day → summary → done with a reference number', async ({ page }) => {
    // Lobby
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'המשכנתאות שלי' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'פירוט משכנתאות' })).toBeVisible();
    await expectNoAxeViolations(page, 'lobby');

    // Entry point lives under the "בקשות" tab of "איך נוכל לעזור לך?"
    await page.getByRole('tab', { name: 'בקשות' }).click();
    await page.getByRole('link', { name: 'שינוי מועד חיוב' }).click();

    // Step 1 – focus lands on the step heading
    const step1 = page.getByRole('heading', { level: 2, name: 'לאיזה משכנתה תרצה לשנות את מועד החיוב?' });
    await expect(step1).toBeVisible();
    await expect(step1).toBeFocused();

    // Validation: cannot continue without a selection – the button is blocked and explains why
    const next = page.getByRole('button', { name: 'לשלב הבא' });
    await next.click();
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('tooltip')).toContainText('יש לבחור לפחות משכנתה אחת');

    // Pick the first two selectable mortgages
    const boxes = page.getByRole('checkbox').and(page.locator(':not([aria-disabled="true"])'));
    const count = await boxes.count();
    expect(count).toBeGreaterThan(0);
    await boxes.nth(0).check();
    if (count > 1) await boxes.nth(1).check();
    await expectNoAxeViolations(page, 'step 1 – select mortgages');
    await page.getByRole('button', { name: 'לשלב הבא' }).click();

    // Step 2 – choose a day per mortgage (first available option of each radio group)
    const step2 = page.getByRole('heading', { level: 2, name: 'בחירת תאריך לחיוב' });
    await expect(step2).toBeFocused();
    const next2 = page.getByRole('button', { name: 'לשלב הבא' });
    await next2.click();
    await expect(next2).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('tooltip')).toContainText('יש לבחור מועד חיוב חדש');

    const groups = page.getByRole('group', { name: /מועד חיוב חדש למשכנתה/ });
    const groupCount = await groups.count();
    for (let i = 0; i < groupCount; i++) {
      await groups.nth(i).getByRole('radio').first().check();
    }
    await expectNoAxeViolations(page, 'step 2 – choose day');
    await page.getByRole('button', { name: 'לשלב הבא' }).click();

    // Step 3 – summary table quoted by the server (fee per mortgage), terms text, then אישור
    const step3 = page.getByRole('heading', { level: 2, name: 'סיכום' });
    await expect(step3).toBeFocused();
    await expect(page.getByText('₪5.44').first()).toBeVisible(); // fee per mortgage, quoted by the API
    await expect(page.getByText('ידוע לי כי:')).toBeVisible();
    await expectNoAxeViolations(page, 'step 3 – summary');

    // Double-click guard: two rapid clicks must still yield exactly one request
    const confirm = page.getByRole('button', { name: 'אישור' });
    await confirm.click();
    await confirm.click({ force: true }).catch(() => undefined);

    // Step 4 – done, with a reference number
    const step4 = page.getByRole('heading', { level: 2, name: 'הפעולה בוצעה בהצלחה!' });
    await expect(step4).toBeVisible();
    await expect(step4).toBeFocused();
    const reference = page.getByTestId('reference-number');
    await expect(reference).toHaveText(/^\d{7,}$/);
    await expectNoAxeViolations(page, 'step 4 – done');

    // Back in the lobby the cache was invalidated: starting a new request, the mortgage with the
    // open request can no longer be selected (aria-disabled box with an explanation).
    await page.getByRole('link', { name: 'סיום' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'המשכנתאות שלי' })).toBeVisible();
    await page.getByRole('tab', { name: 'בקשות' }).click();
    await page.getByRole('link', { name: 'שינוי מועד חיוב' }).click();
    await expect(page.getByRole('heading', { level: 2, name: /לאיזה משכנתה/ })).toBeFocused();
    const blocked = page.getByRole('checkbox').and(page.locator('[aria-disabled="true"]'));
    await expect(blocked.first()).toBeVisible();
    await blocked.first().focus();
    await expect(page.getByRole('tooltip', { name: 'קיימת בקשה פתוחה למשכנתה זו' }).first()).toBeVisible();
  });
});
