/**
 * A list that floats over the page (`SelectMenu`, Plan.md 98 A) is set at the end of the designer's element, outside the
 * menu, chip or bar it belongs to. A check for "a press beside it" would take a press in that list for one outside and
 * close the menu before the choice arrives. `anchored` gives the element that stands for the press in the page: the
 * button of the list for a press inside it, the target itself otherwise.
 */

const owners = new WeakMap<Element, Element>();

/** Marks `panel` as floating for `owner` (the button that opened it). */
export function setFloatingOwner(panel: Element, owner: Element): void {
    owners.set(panel, owner);
}

export function anchored(target: EventTarget | null): Node | null {
    let node = target instanceof Node ? target : null;
    // A list may open from inside another one's panel – follow the owners up to the page.
    for (let i = 0; i < 8 && node; i++) {
        const element = node instanceof Element ? node : node.parentElement;
        const panel = element?.closest('[data-floating]');
        const owner = panel ? owners.get(panel) : undefined;
        if (!owner) return node;
        node = owner;
    }
    return node;
}
