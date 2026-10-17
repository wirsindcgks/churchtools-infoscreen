/**
 * The steps of the introduction to the editor (Plan.md 81) and where its speech bubble goes. Both are plain
 * functions of rectangles, so they are testable without a layout.
 */

export type IntroStepId = 'slides' | 'add' | 'stage' | 'inspector' | 'preview' | 'publish';

/** A step points at the first visible place among its selectors: the column, else the button of its rail. */
export const INTRO_STEPS: { id: IntroStepId; targets: string[] }[] = [
    { id: 'slides', targets: ['.slide-list', '[data-testid="tablet-slides-toggle"]'] },
    { id: 'add', targets: ['[data-testid="add-block-menu"]'] },
    { id: 'stage', targets: ['.editor-stage'] },
    { id: 'inspector', targets: ['[data-testid="inspector-sheet"]', '[data-testid="tablet-inspector-toggle"]'] },
    { id: 'preview', targets: ['[data-testid="open-preview"]'] },
    { id: 'publish', targets: ['[data-testid="save"]'] },
];

export interface Box {
    left: number;
    top: number;
    width: number;
    height: number;
}
export interface Size {
    width: number;
    height: number;
}

/** A rectangle with a width and a height that lies at least partly in the window. */
export function isVisible(box: Box | null, viewport: Size): box is Box {
    if (!box || box.width <= 0 || box.height <= 0) return false;
    return box.left < viewport.width && box.top < viewport.height && box.left + box.width > 0 && box.top + box.height > 0;
}

/** The index of the first visible candidate, or -1 when the place is missing altogether (the step is skipped). */
export function firstVisible(candidates: (Box | null)[], viewport: Size): number {
    return candidates.findIndex((box) => isVisible(box, viewport));
}

const GAP = 12;
const MARGIN = 8;

/**
 * The corner of the bubble: below the place, above, right or left of it – wherever it fits whole – else in the
 * middle of the window. A tall column (more than 60 % of the window) is taken beside first. Always inside the window.
 */
export function bubblePlace(target: Box | null, bubble: Size, viewport: Size): { left: number; top: number } {
    const clamp = (value: number, size: number, limit: number): number => Math.max(MARGIN, Math.min(value, limit - size - MARGIN));
    const centre = (): { left: number; top: number } => ({
        left: clamp((viewport.width - bubble.width) / 2, bubble.width, viewport.width),
        top: clamp((viewport.height - bubble.height) / 2, bubble.height, viewport.height),
    });
    if (!target) return centre();
    const fits = (left: number, top: number): boolean =>
        left >= MARGIN && top >= MARGIN && left + bubble.width <= viewport.width - MARGIN && top + bubble.height <= viewport.height - MARGIN;
    const alignedLeft = clamp(target.left, bubble.width, viewport.width);
    const alignedTop = clamp(target.top, bubble.height, viewport.height);
    const sides = {
        below: { left: alignedLeft, top: target.top + target.height + GAP },
        above: { left: alignedLeft, top: target.top - bubble.height - GAP },
        right: { left: target.left + target.width + GAP, top: alignedTop },
        left: { left: target.left - bubble.width - GAP, top: alignedTop },
    };
    const tall = target.height > viewport.height * 0.6;
    const order: (keyof typeof sides)[] = tall ? ['right', 'left', 'below', 'above'] : ['below', 'above', 'right', 'left'];
    for (const side of order) {
        const { left, top } = sides[side];
        if (fits(left, top)) return { left, top };
    }
    return centre();
}
