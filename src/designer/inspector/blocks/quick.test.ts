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
 * will show, in the order of the inspector.
 */
const QUICK: Record<BlockType, string[]> = {
    text: ['Textstufe', 'Farbe', 'Ausrichtung'],
    image: ['Bild wählen', 'Einpassen'], // "Bild tauschen" once a picture is in
    shape: ['Farbe', 'Ecken'],
    slideshow: ['Bilder hinzufügen', 'Übergang'],
    video: ['Video wählen', 'Ton'],
    clock: ['Darstellung', 'Farbe'],
    'appointment-list': ['Gottesdienst', 'Darstellung', 'Zeitraum', 'Farbe'],
    'next-appointment': ['Gottesdienst', 'Darstellung', 'Terminbild zeigen', 'Farbe'],
    countdown: ['Gottesdienst', 'Titel des Termins zeigen', 'Farbe'],
    'church-header': ['Gemeindenamen zeigen', 'Logo zeigen', 'Farbe'],
    web: ['Adresse oder Einbettungscode', 'Größe der Seite'],
    qr: ['Inhalt', 'Farbe'],
    posts: ['Beitragsgruppe', 'Darstellung', 'Farbe'],
    groups: ['Gruppen-Homepage', 'Darstellung', 'Farbe'],
    rooms: ['Darstellung', 'Zeitraum'],
};

function quickLabels(type: BlockType): string[] {
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
    const wrapper = mount(Host, { global: { plugins: [pinia] } });
    const marked = wrapper.findAll('.field-label, .color-field > span:first-child, button.media-pick, .tile-word').filter((e) => !e.classes().includes('tile-word'));
    return marked.map((e) => e.text());
}

describe('the short menu of the blocks (Plan.md 79, B2)', () => {
    it.each(Object.keys(QUICK) as BlockType[])('%s draws only the fields the table names', (type) => {
        const labels = quickLabels(type);
            expect(labels).toEqual(QUICK[type]);
    });
});
