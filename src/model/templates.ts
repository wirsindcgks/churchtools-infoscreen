/**
 * Expanding templates (schema 1.41, Plan.md 87): the one place that turns a `template` block into the blocks
 * of its template. Everything after it – data collection, images, paging, drawing – sees ordinary blocks only.
 * The result is only shown, never stored: the composed ids can be longer than 64 characters.
 */
import type { ContentBlock, SlideDoc, TemplateDoc } from './schema';

/** The templates a slide uses, without duplicates. */
export function templateIdsOf(slide: SlideDoc): string[] {
    const ids = new Set<string>();
    for (const block of slide.blocks) if (block.type === 'template') ids.add(block.templateId);
    return [...ids];
}

/**
 * Replaces every template block by the blocks of its template, at its place in the paint order and moved by the
 * block's `x`/`y`; its frame, rotation, opacity and lock play no role. A missing template drops the block.
 * Without a template block the slide itself comes back.
 */
export function expandTemplates(slide: SlideDoc, templates: ReadonlyMap<string, TemplateDoc>): SlideDoc {
    if (!slide.blocks.some((b) => b.type === 'template')) return slide;
    const blocks = slide.blocks.flatMap((block): SlideDoc['blocks'] => {
        if (block.type !== 'template') return [block];
        const template = templates.get(block.templateId);
        if (!template) return [];
        return template.blocks.map(
            (child): ContentBlock => ({
                ...child,
                x: block.x + child.x,
                y: block.y + child.y,
                id: `${block.id}/${child.id}`,
                ...(child.groupId !== undefined ? { groupId: `${block.id}/${child.groupId}` } : {}),
            }),
        );
    });
    return { ...slide, blocks };
}
