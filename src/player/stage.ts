/**
 * The stage has fixed pixel dimensions; one scale factor maps it onto the
 * viewport. A mismatched aspect ratio is letterboxed, never cropped, and an
 * overscan correction shrinks the usable area on TVs that cut the edges
 * (Plan.md, Architektur).
 */
export interface StageFit {
    scale: number;
    offsetX: number;
    offsetY: number;
}

export function fitStage(
    viewport: { width: number; height: number },
    stage: { width: number; height: number },
    overscanPercent = 0,
): StageFit {
    const inset = Math.min(Math.max(overscanPercent, 0), 20) / 100;
    const usableWidth = viewport.width * (1 - 2 * inset);
    const usableHeight = viewport.height * (1 - 2 * inset);
    const scale = Math.max(Math.min(usableWidth / stage.width, usableHeight / stage.height), 0);
    return {
        scale,
        offsetX: (viewport.width - stage.width * scale) / 2,
        offsetY: (viewport.height - stage.height * scale) / 2,
    };
}
