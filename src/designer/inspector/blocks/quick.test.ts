import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, provide, type Component } from 'vue';
import type { BlockType } from '../../../model/schema';
import { provideStageContext } from '../../../player/context';
import { createBlock } from '../../ops';
import { INSPECTOR_CONTEXT } from '../context';
import { INSPECTOR_MODE } from '../mode';
import { BLOCK_INSPECTORS } from '.';

/**
 * The marks `quick` of every block, against the table in Plan.md 79 (B2, "Kurzmenü vorbereitet"): what the short menu
 * shows, in the order of the inspector – as the chips are named for a screen reader ("label: what it holds now", or just what it holds where that starts with the label), a
 * field that stands in the menu by its label, a medium by its button.
 */
const QUICK: Record<BlockType, string[]> = {
    text: ['Textstufe: Überschrift', 'Farbe', 'Ausrichtung'],
    image: ['Bild wählen', 'Einpassen: Ganz zeigen', 'Ton: Ohne'], // "Bild tauschen" once a picture is in
    shape: ['Form: Rechteck', 'Farbe', 'Ecken 0 px'],
    line: ['Farbe', 'Stärke 8 px', 'Strich: Durchgezogen'],
    slideshow: ['Bilder hinzufügen', 'Übergang: Überblenden'],
    video: ['Video wählen', 'Ton'],
    clock: ['Darstellung: Uhrzeit', 'Farbe'],
    'appointment-list': ['Kalender · 1', 'Darstellung: Wie im Design', 'Zeitraum 14 Tage', 'Farbe'],
    'next-appointment': ['Kalender · 1', 'Darstellung: Wie im Design', 'Terminbild zeigen', 'Farbe'],
    countdown: ['Kalender · 1', 'Titel des Termins zeigen', 'Farbe'],
    'church-header': ['Gemeindenamen zeigen', 'Logo zeigen', 'Farbe'],
    web: ['Adresse oder Einbettungscode', 'Größe der Seite: 100 %'],
    qr: ['Inhalt', 'Farbe'],
    posts: ['Gruppen · 0', 'Darstellung: Hervorgehoben', 'Farbe'],
    groups: ['Gruppen-Homepage: – wählen –', 'Darstellung: Hervorgehoben', 'Farbe'],
    rooms: ['Räume · 0', 'Darstellung: Übersicht', 'Zeitraum: Heute'],
};

function draw(type: BlockType) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const block = createBlock(type, { width: 1920, height: 1080 }, [1]);
    const Host = defineComponent({
        setup() {
            provideStageContext({ now: new Date(), timeZone: 'Europe/Berlin', clockConfirmed: true, churchName: '', appointments: [], media: new Map() });
            provide(INSPECTOR_MODE, 'quick');
            provide(INSPECTOR_CONTEXT, {
                pickImage: () => undefined,
                calendars: [{ id: 1, name: 'Gottesdienst' }],
                groups: [{ id: 5, name: 'Beitragsgruppe', visibility: 'public' }],
                homepages: [{ parentGroupId: 9, title: 'Homepage', hash: 'x' }],
                rooms: [{ id: 3, name: 'Saal' }],
            });
            return () => h(BLOCK_INSPECTORS[type] as Component, { block });
        },
    });
    const container = document.createElement('div');
    mount(Host, { attachTo: container, global: { plugins: [pinia] } });
    return container;
}

/** What the short menu shows of each field, in order: the name of a chip, the label of a field that stands there, the button of a medium. */
function quickItems(type: BlockType): string[] {
    const found = draw(type).querySelectorAll('[data-testid="quick-chip"], [data-quick-inline], button.quick-chip[data-quick-open]');
    return [...found].map((el) => {
        if (el.getAttribute('data-testid') === 'quick-chip') return el.getAttribute('aria-label')!;
        if (el.hasAttribute('data-quick-inline')) return el.querySelector('.field-label')!.textContent!.trim();
        return el.textContent!.trim();
    });
}

describe('the short menu of the blocks (Plan.md 79, B2)', () => {
    it.each(Object.keys(QUICK) as BlockType[])('%s draws only the fields the table names', (type) => {
        expect(quickItems(type)).toEqual(QUICK[type]);
    });

    it.each(Object.keys(QUICK) as BlockType[])('%s draws nothing but fields (no hint, count or button of its own)', (type) => {
        const container = draw(type);
        // What a field draws is the chip, the field standing in the menu, or the button of a medium – take those away,
        // and no text, control or picture may be left (a bare wrapper of a layout is no harm).
        container.querySelectorAll('[data-testid="quick-chip"], [data-quick-inline], button.quick-chip').forEach((el) => el.remove());
        expect(container.textContent!.trim()).toBe('');
        expect(container.querySelectorAll('input, button, select, textarea, img, svg, hr')).toHaveLength(0);
    });
});
