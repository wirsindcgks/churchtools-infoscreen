/** The factors of the font size in the reading mode (Plan.md 138); 1 is the size the page sets itself. */
export const scaleSteps = [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];
const START = scaleSteps.indexOf(1);
const SCALE_KEY = 'infoscreen-designer.control-reading-scale';
const READING_KEY = 'infoscreen-designer.control-reading';

/** The step remembered on this device. */
export function readScale(): number {
    try {
        const n = scaleSteps.indexOf(Number(localStorage.getItem(SCALE_KEY)));
        return n >= 0 ? n : START;
    } catch {
        return START;
    }
}

export function writeScale(index: number): void {
    try {
        localStorage.setItem(SCALE_KEY, String(scaleSteps[index]));
    } catch {
        // Not remembered, the page still works.
    }
}

export function readReading(): boolean {
    try {
        return localStorage.getItem(READING_KEY) === '1';
    } catch {
        return false;
    }
}

export function writeReading(on: boolean): void {
    try {
        if (on) localStorage.setItem(READING_KEY, '1');
        else localStorage.removeItem(READING_KEY);
    } catch {
        // Not remembered, the page still works.
    }
}

/** Whether the start of the running part is out of the reading area: above its top edge, or lower than three lines above its bottom edge. */
export function isAway(partTop: number, boxTop: number, boxBottom: number, lineHeight: number): boolean {
    return partTop < boxTop - 2 || partTop > boxBottom - 3 * lineHeight;
}
