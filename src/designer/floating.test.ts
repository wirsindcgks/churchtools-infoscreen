import { describe, expect, it } from 'vitest';
import { anchored, setFloatingOwner } from './floating';

describe('anchored', () => {
    it('gives the button of a floating list for a press inside it, the target itself otherwise', () => {
        const menu = document.createElement('div');
        const button = document.createElement('button');
        menu.append(button);
        const panel = document.createElement('div');
        panel.setAttribute('data-floating', '');
        const option = document.createElement('li');
        panel.append(option);
        document.body.append(menu, panel);
        setFloatingOwner(panel, button);

        expect(anchored(option)).toBe(button);
        expect(menu.contains(anchored(option))).toBe(true);
        expect(anchored(button)).toBe(button);
        expect(anchored(null)).toBeNull();
    });

    it('follows a list opened from inside another floating list', () => {
        const button = document.createElement('button');
        const outer = document.createElement('div');
        outer.setAttribute('data-floating', '');
        const innerButton = document.createElement('button');
        outer.append(innerButton);
        const inner = document.createElement('div');
        inner.setAttribute('data-floating', '');
        const option = document.createElement('li');
        inner.append(option);
        document.body.append(button, outer, inner);
        setFloatingOwner(outer, button);
        setFloatingOwner(inner, innerButton);

        expect(anchored(option)).toBe(button);
    });
});
