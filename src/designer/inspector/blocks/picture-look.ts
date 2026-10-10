import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';

type PictureBlock = Extract<Block, { type: 'image' | 'video' | 'slideshow' }>;

const SHADOW_LABELS = { soft: t.inspector.shadowSoft, strong: t.inspector.shadowStrong } as const;

/** The folded "Darstellung" of a picture, video or gallery: what it already says, then corners and shadow (only at "Füllen", where they act). */
export function lookSummary(block: PictureBlock, base: string | undefined, ...more: (string | undefined)[]): string {
    const parts = [base, ...more];
    if (block.fit === 'cover' || (block.type === 'slideshow' && block.fit === undefined)) {
        if (block.cornerRadius) parts.push(`${t.inspector.cornerRadius} ${block.cornerRadius} px`);
        if (block.shadow && block.shadow !== 'none') parts.push(`${t.inspector.shadow} ${SHADOW_LABELS[block.shadow].toLowerCase()}`);
    }
    return parts.filter(Boolean).join(' · ');
}
