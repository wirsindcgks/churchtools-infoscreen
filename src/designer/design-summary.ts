import { t } from '../i18n/designer';
import { fontDef } from '../player/fonts';
import type { ThemeDoc } from '../model/schema';

/** What the folded sections of the Design page say about what is set inside (Plan.md 89). */

export function paletteSummary(palette: readonly unknown[]): string {
    return t.design.summary.palette(palette.length);
}

export function surfacesSummary(theme: Pick<ThemeDoc, 'corners' | 'cards' | 'cardOpacity'>): string {
    const s = t.design.summary;
    const cards = theme.cards === 'color' ? s.cards.color(theme.cardOpacity) : s.cards[theme.cards];
    return `${s.corners[theme.corners]} · ${cards}`;
}

/** An unknown key draws as the default font, and so it is named; a custom font is named as the church called it. */
export function fontSummary(theme: Pick<ThemeDoc, 'font'>): string {
    return fontDef(theme.font).label;
}

export function appointmentsSummary(theme: Pick<ThemeDoc, 'appointments' | 'imageRatio'>): string {
    const s = t.design.summary;
    const images = theme.imageRatio === 'free' ? s.imagesFree : s.images(theme.imageRatio);
    return `${s.appointments[theme.appointments === 'large' ? 'large' : 'native']} · ${images}`;
}
