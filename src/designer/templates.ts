/**
 * Templates in the editor (schema 1.41, Plan.md 87): pure helpers that make a template out of blocks, give a template
 * block the frame of its template, and turn a template block back into blocks of its own.
 */
import type { Block, ContentBlock, SlideDoc, TemplateDoc } from '../model/schema';
import { boundingBox, cloneJson, dropSingleGroups, newId } from './ops';

export type TemplateBlock = Extract<Block, { type: 'template' }>;
/** What `saveTemplate` takes: the fields the repository does not set itself. */
export type NewTemplate = Omit<TemplateDoc, 'schema' | 'kind' | 'revision' | 'updatedBy' | 'updatedAt'>;

/** The longest name of a template. */
export const TEMPLATE_NAME_MAX = 40;

/**
 * Gives every template block the `width`/`height` of its template – the copy in the block can be out of date – and the
 * lock of a template that is fixed in place (shown only, never written). A template that is missing leaves the copy. Without a template block the very same slide comes back.
 */
export function withTemplateFrames(slide: SlideDoc, byId: ReadonlyMap<string, TemplateDoc>): SlideDoc {
    if (!slide.blocks.some((b) => b.type === 'template')) return slide;
    return {
        ...slide,
        blocks: slide.blocks.map((b) => {
            if (b.type !== 'template') return b;
            const template = byId.get(b.templateId);
            if (!template) return b;
            const fixed = !!template.locked && !b.locked;
            return b.width !== template.width || b.height !== template.height || fixed
                ? { ...b, width: template.width, height: template.height, ...(fixed ? { locked: true } : {}) }
                : b;
        }),
    };
}

/**
 * The fields of a new template made of these blocks, in paint order: the frame is the box around them (a turned block
 * counts by its outer box), rounded; the blocks lie relative to its upper left corner, `x`/`y` remember where it was.
 * Groups stay, a group of one is dissolved; a lock stays behind on the slide (the template block takes it). The caller
 * sets nothing but the revision data.
 */
export function templateFromBlocks(
    blocks: readonly ContentBlock[],
    stage: { width: number; height: number },
    name: string,
): NewTemplate {
    const box = boundingBox(blocks);
    if (!box) throw new Error('A template needs at least one block.');
    const x = Math.round(box.x);
    const y = Math.round(box.y);
    const children = blocks.map((b): ContentBlock => {
        const child = { ...cloneJson(b), x: b.x - x, y: b.y - y };
        delete child.locked;
        delete child.region;
        return child;
    });
    dropSingleGroups(children);
    return {
        id: newId(),
        name: name.trim().slice(0, TEMPLATE_NAME_MAX),
        stage: { width: stage.width, height: stage.height },
        width: Math.max(1, Math.round(box.width)),
        height: Math.max(1, Math.round(box.height)),
        x,
        y,
        blocks: children,
    };
}

/**
 * The blocks of the template as blocks of their own: new ids, moved by the position of the template block. From two
 * blocks on they form one new group (whatever groups the template had), otherwise there is none.
 */
export function dissolveTemplate(block: Pick<TemplateBlock, 'x' | 'y'>, template: TemplateDoc): ContentBlock[] {
    const groupId = template.blocks.length >= 2 ? newId() : undefined;
    return template.blocks.map((child): ContentBlock => {
        const copy = { ...cloneJson(child), id: newId(), x: block.x + child.x, y: block.y + child.y };
        delete copy.groupId;
        return groupId ? { ...copy, groupId } : copy;
    });
}
