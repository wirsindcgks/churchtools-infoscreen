<script setup lang="ts">
/**
 * The look of all screens (Plan.md, Nächste Schritte 27): corners, colours,
 * the font new blocks start with (40), the plain or the large appointment
 * blocks and the shape of their images –
 * set once instead of in every block. A live preview shows it with the
 * player's own components and real appointments. Designers save it like a
 * playlist, against its revision.
 */
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { currentPerson, displayName } from '../ct/client';
import ColorField from '../designer/ColorField.vue';
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';
import { t } from '../i18n/designer';
import { usePreview } from '../designer/usePreview';
import { createBlock, createSlide } from '../designer/ops';
import PaletteScope from '../designer/PaletteScope.vue';
import { DEFAULT_THEME, type Block, type SlideDoc, type ThemeDoc } from '../model/schema';
import SlideView from '../player/SlideView.vue';
import StageView from '../player/StageView.vue';
import FontField from '../designer/inspector/fields/FontField.vue';
import { fitStage } from '../player/stage';
import { getRepository } from '../store/backend';
import { ConflictError, type ScreenRepository } from '../store/screen-repository';

type Look = Pick<ThemeDoc, 'corners' | 'accent' | 'text' | 'background' | 'font' | 'appointments' | 'imageRatio' | 'cards' | 'cardColor' | 'cardOpacity'> & Required<Pick<ThemeDoc, 'palette'>>;

const repository = shallowRef<ScreenRepository | null>(null);
const author = ref<string | null>(null);
const error = ref<string | null>(null);
/** Revision the page started from; null while there is no theme yet. */
const revision = ref<number | null>(null);
const saved = ref<Look>(pick(DEFAULT_THEME));
const look = ref<Look>(pick(DEFAULT_THEME));
const status = ref<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
const message = ref<string | null>(null);

function pick(theme: ThemeDoc): Look {
    const { corners, accent, text, background, font, appointments, imageRatio, cards, cardColor, cardOpacity } = theme;
    return { corners, accent, text, background, font, appointments, imageRatio, cards, cardColor, cardOpacity, palette: theme.palette ?? [] };
}

/** The palette is a list: a copy must not share it, or editing `look` would change `saved`, too. */
function copyLook(from: Look): Look {
    return { ...from, palette: from.palette.map((p) => ({ ...p })) };
}

const PALETTE_MAX = 12;

function addPaletteColor(): void {
    if (look.value.palette.length < PALETTE_MAX) look.value.palette.push({ name: '', color: look.value.accent });
}

function movePaletteColor(index: number, by: -1 | 1): void {
    const list = look.value.palette;
    const target = index + by;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target]!, list[index]!];
}

const dirty = computed(() => JSON.stringify(look.value) !== JSON.stringify(saved.value));
const theme = computed<ThemeDoc>(() => ({ ...DEFAULT_THEME, ...look.value }));

// The preview: real appointments of the first calendars, shown as the TV would show them.
const calendarIds = ref<number[]>([]);
const { calendars } = usePreview(calendarIds, ref([]), theme);

const STAGE = { width: 1920, height: 1080 };
/** Blocks without a layout of their own: they follow the theme, as every such block on the screens does. */
const previewSlide = computed<SlideDoc>(() => {
    const ids = calendars.value.slice(0, 3).map((c) => c.id);
    const slide = createSlide('Vorschau', theme.value);
    const next = createBlock('next-appointment', STAGE, ids, theme.value) as Extract<Block, { type: 'next-appointment' }>;
    const list = createBlock('appointment-list', STAGE, ids, theme.value);
    slide.blocks = [
        // Fixed ids: the blocks stay mounted while the look changes.
        // The preview shows the look, not the size: at the default 64 px a long title takes three lines beside
        // the image, and the card would crowd out the list (seen 2026-09-28). At 52 px title, subtitle, day
        // and time fit the card with room to spare.
        { ...next, id: 'preview-next', x: 80, y: 40, width: 1760, height: 560, style: { ...next.style, fontSize: 52 } },
        { ...list, id: 'preview-list', x: 80, y: 640, width: 1760, height: 400, limit: 4 } as typeof list,
    ];
    return slide;
});
// Once the calendars are known, the preview asks for their appointments.
watch(
    () => calendars.value.slice(0, 3).map((c) => c.id),
    (ids) => (calendarIds.value = ids),
);

const previewBox = ref<HTMLElement | null>(null);
const previewWidth = ref(0);
const fit = computed(() => fitStage({ width: previewWidth.value, height: (previewWidth.value * 9) / 16 }, STAGE));

const RATIOS: { value: ThemeDoc['imageRatio']; label: string }[] = [
    { value: '16:9', label: t.design.ratios.wide },
    { value: '3:2', label: '3:2' },
    { value: '4:3', label: '4:3' },
    { value: '1:1', label: t.design.ratios.square },
    { value: 'free', label: t.design.ratios.free },
];

async function load(): Promise<void> {
    if (!repository.value) return;
    const stored = await repository.value.loadTheme();
    revision.value = stored ? (stored.revision ?? 0) : null;
    saved.value = copyLook(pick(stored ?? DEFAULT_THEME));
    look.value = copyLook(saved.value);
}

async function save(): Promise<void> {
    if (!repository.value || !author.value) return;
    status.value = 'saving';
    message.value = null;
    try {
        const stored = await repository.value.saveTheme(look.value, {
            expectedRevision: revision.value,
            updatedBy: author.value,
        });
        revision.value = stored.revision ?? 0;
        saved.value = copyLook(look.value);
        status.value = 'saved';
    } catch (e) {
        if (e instanceof ConflictError) {
            status.value = 'conflict';
            message.value = t.design.conflict(e.current.updatedBy);
        } else {
            status.value = 'error';
            message.value = e instanceof Error ? e.message : String(e);
        }
    }
}

async function reload(): Promise<void> {
    status.value = 'idle';
    message.value = null;
    await load();
}

let observer: ResizeObserver | null = null;
onMounted(async () => {
    try {
        const [person, handle] = await Promise.all([currentPerson(), getRepository()]);
        repository.value = handle.repository;
        await load();
        author.value = displayName(person);
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    }
    observer = new ResizeObserver(([entry]) => {
        if (entry) previewWidth.value = entry.contentRect.width;
    });
});

/** The preview box appears only after loading; observe it then. */
function observe(el: unknown): void {
    if (el instanceof HTMLElement && el !== previewBox.value) {
        previewBox.value = el;
        observer?.observe(el);
    }
}

</script>

<template>
    <ModulePage current="design">
        <template #actions>
            <span v-if="status === 'saved' && !dirty" class="ok" data-testid="theme-saved">
                {{ t.design.savedHint }}
            </span>
            <button class="d-btn" type="button" :disabled="!dirty" @click="look = copyLook(saved)">{{ t.design.discard }}</button>
            <button
                class="d-btn d-btn--primary"
                type="button"
                :disabled="!dirty || status === 'saving'"
                data-testid="theme-save"
                @click="save"
            >
                {{ status === 'saving' ? t.design.saving : t.common.save }}
            </button>
        </template>

        <PageHeader icon="palette" :title="t.design.title" testid="design-heading">
            {{ t.design.intro }}
        </PageHeader>

        <p v-if="message" class="d-banner d-banner--error" role="alert">
            {{ message }}
            <button v-if="status === 'conflict'" class="d-btn" type="button" @click="reload">{{ t.schedules.dialog.reload }}</button>
        </p>
        <p v-if="error" class="d-banner d-banner--error" role="alert">{{ error }}</p>
        <p v-else-if="author === null || !repository" class="empty">{{ t.common.loading }}</p>
        <div v-else class="layout">
            <div class="d-card settings">
                <section class="box" aria-labelledby="box-corners">
                    <h2 id="box-corners">{{ t.design.corners.title }}</h2>
                    <div class="choice" role="radiogroup" aria-labelledby="box-corners">
                        <label v-for="c in (['round', 'square'] as const)" :key="c" class="option" :class="{ on: look.corners === c }">
                            <input v-model="look.corners" type="radio" name="corners" :value="c" :data-testid="`corners-${c}`">
                            <span class="corner-sample" :class="`corner-sample--${c}`" aria-hidden="true" />
                            {{ c === 'round' ? t.design.corners.round : t.design.corners.square }}
                        </label>
                    </div>
                    <p class="hint">{{ t.design.corners.hint }}</p>
                </section>

                <section class="box" aria-labelledby="box-colours">
                    <h2 id="box-colours">{{ t.design.colors.title }}</h2>
                    <ColorField v-model="look.accent" :label="t.common.color.accent" testid="theme-accent" />
                    <p class="hint">{{ t.design.colors.accentHint }}</p>
                    <div class="grid2">
                        <ColorField v-model="look.text" :label="t.common.color.text" testid="theme-text" />
                        <ColorField v-model="look.background" :label="t.common.color.background" testid="theme-background" />
                    </div>
                    <p class="hint">{{ t.design.colors.textHint }}</p>
                </section>

                <section class="box" aria-labelledby="box-cards">
                    <h2 id="box-cards">{{ t.design.cards.title }}</h2>
                    <div class="choice" role="radiogroup" aria-labelledby="box-cards">
                        <label class="option option--wide" :class="{ on: look.cards === 'tint' }">
                            <input v-model="look.cards" type="radio" name="cards" value="tint" data-testid="cards-tint">
                            <span><strong>{{ t.design.cards.tint }}</strong><br><small>{{ t.design.cards.tintHint }}</small></span>
                        </label>
                        <label class="option option--wide" :class="{ on: look.cards === 'none' }">
                            <input v-model="look.cards" type="radio" name="cards" value="none" data-testid="cards-none">
                            <span><strong>{{ t.design.cards.none }}</strong><br><small>{{ t.design.cards.noneHint }}</small></span>
                        </label>
                        <label class="option option--wide" :class="{ on: look.cards === 'color' }">
                            <input v-model="look.cards" type="radio" name="cards" value="color" data-testid="cards-color">
                            <span><strong>{{ t.design.cards.color }}</strong><br><small>{{ t.design.cards.colorHint }}</small></span>
                        </label>
                    </div>
                    <template v-if="look.cards === 'color'">
                        <!-- Only this field offers the palette, as it is being edited; the page shows no swatches elsewhere (e2e/palette.spec.ts). -->
                        <PaletteScope :theme="theme">
                            <ColorField v-model="look.cardColor" :label="t.design.cards.colorLabel" testid="theme-card-color" />
                        </PaletteScope>
                        <label class="d-field">
                            {{ t.design.cards.opacity }}
                            <input v-model.number="look.cardOpacity" type="range" min="0" max="100" step="5" data-testid="theme-card-opacity">
                            <output>{{ look.cardOpacity }} %</output>
                        </label>
                    </template>
                    <p class="hint">{{ t.design.cards.hint }}</p>
                </section>

                <section class="box" aria-labelledby="box-palette">
                    <h2 id="box-palette">{{ t.design.palette.title }}</h2>
                    <p class="hint">{{ t.design.palette.hint }}</p>
                    <div v-for="(entry, i) in look.palette" :key="i" class="palette-entry" data-testid="palette-entry">
                        <ColorField v-model="entry.color" :label="t.design.palette.colorN(i + 1)" />
                        <label class="d-field">
                            {{ t.common.name }}
                            <input
                                v-model="entry.name"
                                type="text"
                                maxlength="40"
                                :placeholder="t.design.palette.namePlaceholder"
                                autocomplete="off"
                                data-testid="palette-name"
                            >
                        </label>
                        <div class="palette-actions">
                            <button
                                class="d-btn d-btn--icon"
                                type="button"
                                :disabled="i === 0"
                                :aria-label="t.design.palette.moveUp(i + 1)"
                                :title="t.common.moveUp"
                                data-testid="palette-up"
                                @click="movePaletteColor(i, -1)"
                            >
                                <Icon name="layer-forward" />
                            </button>
                            <button
                                class="d-btn d-btn--icon"
                                type="button"
                                :disabled="i === look.palette.length - 1"
                                :aria-label="t.design.palette.moveDown(i + 1)"
                                :title="t.common.moveDown"
                                data-testid="palette-down"
                                @click="movePaletteColor(i, 1)"
                            >
                                <Icon name="layer-backward" />
                            </button>
                            <button
                                class="d-btn d-btn--icon"
                                type="button"
                                :aria-label="t.design.palette.remove(i + 1)"
                                :title="t.common.remove"
                                data-testid="palette-remove"
                                @click="look.palette.splice(i, 1)"
                            >
                                <Icon name="trash" />
                            </button>
                        </div>
                    </div>
                    <div>
                        <button
                            class="d-btn"
                            type="button"
                            :disabled="look.palette.length >= PALETTE_MAX"
                            data-testid="palette-add"
                            @click="addPaletteColor"
                        >
                            <Icon name="plus" /> {{ t.design.palette.add }}
                        </button>
                    </div>
                    <p v-if="look.palette.length >= PALETTE_MAX" class="hint">{{ t.design.palette.max(PALETTE_MAX) }}</p>
                </section>

                <section class="box" aria-labelledby="box-font">
                    <h2 id="box-font">{{ t.design.font.title }}</h2>
                    <!-- An unknown key stays stored until someone picks a font; it draws as Lato meanwhile. -->
                    <FontField :model-value="look.font" :label="t.inspector.fontFamily" testid="theme-font" @update:model-value="look.font = $event" />
                    <p class="hint">{{ t.design.font.hint }}</p>
                </section>

                <section class="box" aria-labelledby="box-appointments">
                    <h2 id="box-appointments">{{ t.design.appointments.title }}</h2>
                    <div class="choice" role="radiogroup" aria-labelledby="box-appointments">
                        <label class="option option--wide" :class="{ on: look.appointments === 'native' }">
                            <input v-model="look.appointments" type="radio" name="appointments" value="native" data-testid="appointments-native">
                            <span><strong>{{ t.design.appointments.native }}</strong><br><small>{{ t.design.appointments.nativeHint }}</small></span>
                        </label>
                        <label class="option option--wide" :class="{ on: look.appointments === 'large' }">
                            <input v-model="look.appointments" type="radio" name="appointments" value="large" data-testid="appointments-large">
                            <span><strong>{{ t.design.appointments.modern }}</strong><br><small>{{ t.design.appointments.modernHint }}</small></span>
                        </label>
                    </div>
                </section>

                <section class="box" aria-labelledby="box-images">
                    <h2 id="box-images">{{ t.design.images.title }}</h2>
                    <label class="d-field">
                        {{ t.common.format }}
                        <select v-model="look.imageRatio" data-testid="theme-image-ratio">
                            <option v-for="r in RATIOS" :key="r.value" :value="r.value">{{ r.label }}</option>
                        </select>
                    </label>
                    <p class="hint">{{ t.design.images.hint }}</p>
                </section>
            </div>

            <section class="d-card preview" aria-labelledby="box-preview">
                <h2 id="box-preview">{{ t.design.preview.title }}</h2>
                <div :ref="observe" class="preview-box" data-testid="theme-preview">
                    <StageView v-if="previewWidth" :width="STAGE.width" :height="STAGE.height" :fit="fit">
                        <SlideView :slide="previewSlide" :width="STAGE.width" :height="STAGE.height" />
                    </StageView>
                </div>
                <p class="hint">{{ t.design.preview.hint }}</p>
            </section>
        </div>
    </ModulePage>
</template>

<style scoped>
.empty {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
/*
 * Two boxes side by side: the settings one below the other, and the
 * preview. Both stop at a width where fields and stage are still easy to
 * take in – wider only makes them bigger, not clearer (2026-09-25).
 */
.layout {
    display: grid;
    grid-template-columns: minmax(320px, 640px) minmax(340px, 640px);
    gap: 16px;
    align-items: start;
}
.settings {
    display: grid;
    gap: 16px;
    padding: 16px 20px 20px;
}
/* The settings one below the other, a line between them. */
.settings .box + .box {
    padding-top: 16px;
    border-top: 1px solid var(--d-divider);
}
.box,
.preview {
    display: grid;
    align-content: start;
    gap: 10px;
}
.preview {
    padding: 16px 20px;
}
h2 {
    margin: 0;
    font-size: 1.05em;
}
.choice {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    cursor: pointer;
}
/* The module's field style makes inputs full width; a radio button keeps its own size. */
.option input {
    flex: none;
    width: auto;
    margin: 0;
}
.option.on {
    border-color: var(--d-interactive);
    background: var(--d-accent-pale);
}
.option--wide {
    grid-column: 1 / -1;
    align-items: flex-start;
}
.option small {
    color: var(--d-text-muted);
}
.corner-sample {
    width: 22px;
    height: 16px;
    border: 2px solid currentColor;
}
.corner-sample--round {
    border-radius: 5px;
}
.grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.palette-entry {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 8px;
    align-items: end;
}
.palette-actions {
    display: flex;
    gap: 2px;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.ok {
    color: var(--d-success);
    font-size: var(--d-size-sm);
}
.preview {
    position: sticky;
    top: 12px;
}
.preview-box {
    position: relative;
    overflow: hidden;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--d-radius);
    background: var(--d-text);
}
/* Narrow: the preview on top, no wider than beside the cards. */
@media (max-width: 60rem) {
    .layout {
        grid-template-columns: minmax(0, 1fr);
    }
    .preview {
        position: static;
        order: -1;
        width: 100%;
        max-width: 640px;
        box-sizing: border-box;
    }
}
</style>
