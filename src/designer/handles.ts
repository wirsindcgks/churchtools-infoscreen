/** Size of the area that catches a fingertip on a handle (Plan.md 79, C3), in screen pixels. */
export const HIT_SIZE = 44;

/**
 * Whether the handles stand outside the frame: on a block narrower or lower than three fingertips the middle and corner
 * handles would fall into each other, so each moves out by half a hit area.
 */
export function handlesOutside(shown: { width: number; height: number }): boolean {
    return shown.width < 3 * HIT_SIZE || shown.height < 3 * HIT_SIZE;
}
