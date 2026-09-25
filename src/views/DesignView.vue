<script setup lang="ts">
/**
 * The look of all screens (Plan.md, Nächste Schritte 27): corners, colours,
 * the plain or the large appointment blocks and the shape of their images –
 * set once instead of in every block. A live preview shows it with the
 * player's own components and real appointments. Designers save it like a
 * playlist, against its revision.
 */
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { currentPerson, displayName } from '../ct/client';
import ColorField from '../designer/ColorField.vue';
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import { usePreview } from '../designer/usePreview';
import { createBlock, createSlide } from '../designer/ops';
import { DEFAULT_THEME, type SlideDoc, type ThemeDoc } from '../model/schema';
import SlideView from '../player/SlideView.vue';
import StageView from '../player/StageView.vue';
import { fitStage } from '../player/stage';
import { canManagePermissions } from '../setup/load';
import { getRepository } from '../store/backend';
import { ConflictError, type ScreenRepository } from '../store/screen-repository';

type Look = Pick<ThemeDoc, 'corners' | 'accent' | 'text' | 'background' | 'appointments' | 'imageRatio'>;

const repository = shallowRef<ScreenRepository | null>(null);
const author = ref<string | null>(null);
const admin = ref(false);
const error = ref<string | null>(null);
/** Revision the page started from; null while there is no theme yet. */
const revision = ref<number | null>(null);
const saved = ref<Look>(pick(DEFAULT_THEME));
const look = ref<Look>(pick(DEFAULT_THEME));
const status = ref<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
const message = ref<string | null>(null);

function pick(theme: ThemeDoc): Look {
    const { corners, accent, text, background, appointments, imageRatio } = theme;
    return { corners, accent, text, background, appointments, imageRatio };
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
    const next = createBlock('next-appointment', STAGE, ids, theme.value);
    const list = createBlock('appointment-list', STAGE, ids, theme.value);
    slide.blocks = [
        // Fixed ids: the blocks stay mounted while the look changes.
        { ...next, id: 'preview-next', x: 80, y: 60, width: 1760, height: 440 },
        { ...list, id: 'preview-list', x: 80, y: 560, width: 1760, height: 460, limit: 4 } as typeof list,
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
    { value: '16:9', label: '16:9 – breit' },
    { value: '3:2', label: '3:2' },
    { value: '4:3', label: '4:3' },
    { value: '1:1', label: '1:1 – quadratisch' },
    { value: 'free', label: 'Frei – wie das Bild' },
];

async function load(): Promise<void> {
    if (!repository.value) return;
    const stored = await repository.value.loadTheme();
    revision.value = stored ? (stored.revision ?? 0) : null;
    saved.value = pick(stored ?? DEFAULT_THEME);
    look.value = { ...saved.value };
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
        saved.value = { ...look.value };
        status.value = 'saved';
    } catch (e) {
        if (e instanceof ConflictError) {
            status.value = 'conflict';
            message.value = `Inzwischen hat ${e.current.updatedBy ?? 'jemand'} das Design geändert.`;
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
        const [person, handle, isAdmin] = await Promise.all([
            currentPerson(),
            getRepository(),
            canManagePermissions().catch(() => false),
        ]);
        admin.value = isAdmin;
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
    <div class="infoscreen-designer home">
        <p v-if="error" class="d-banner d-banner--error page-message" role="alert">{{ error }}</p>
        <template v-else-if="author !== null && repository">
            <ModulePage current="design" :admin="admin">
                <div class="page-title">
                    <span class="title-icon"><Icon name="palette" :size="20" /></span>
                    <h1 data-testid="design-heading">Design</h1>
                </div>
                <p class="muted intro">
                    Das Erscheinungsbild aller Screens. Ecken, Akzentfarbe, Darstellung der Termine und Bildformat gelten
                    sofort überall; ein Baustein mit eigener Darstellung behält sie. Text- und Hintergrundfarbe bekommen
                    neue Slides und Bausteine.
                </p>

                <div class="layout">
                    <section class="d-card settings" aria-label="Einstellungen">
                        <fieldset class="choice">
                            <legend>Ecken</legend>
                            <label v-for="c in (['round', 'square'] as const)" :key="c" class="option" :class="{ on: look.corners === c }">
                                <input v-model="look.corners" type="radio" name="corners" :value="c" :data-testid="`corners-${c}`">
                                <span class="corner-sample" :class="`corner-sample--${c}`" aria-hidden="true" />
                                {{ c === 'round' ? 'Rund' : 'Eckig' }}
                            </label>
                        </fieldset>

                        <fieldset>
                            <legend>Farben</legend>
                            <ColorField v-model="look.accent" label="Akzent" testid="theme-accent" />
                            <p class="hint">Für Kalender ohne eigene Farbe, für Kacheln und den Seitenbalken.</p>
                            <div class="grid2">
                                <ColorField v-model="look.text" label="Text" testid="theme-text" />
                                <ColorField v-model="look.background" label="Hintergrund" testid="theme-background" />
                            </div>
                            <p class="hint">Text und Hintergrund gelten für neue Slides und Bausteine; bestehende bleiben, wie sie sind.</p>
                        </fieldset>

                        <fieldset class="choice">
                            <legend>Termine</legend>
                            <label class="option option--wide" :class="{ on: look.appointments === 'native' }">
                                <input v-model="look.appointments" type="radio" name="appointments" value="native" data-testid="appointments-native">
                                <span><strong>Nativ</strong><br><small>Schlichte Zeilen, der nächste Termin mit Bild daneben.</small></span>
                            </label>
                            <label class="option option--wide" :class="{ on: look.appointments === 'large' }">
                                <input v-model="look.appointments" type="radio" name="appointments" value="large" data-testid="appointments-large">
                                <span><strong>Groß</strong><br><small>Karten wie im WordPress-Plugin mit Datumskachel und Kalender; der nächste Termin hervorgehoben.</small></span>
                            </label>
                        </fieldset>

                        <label class="d-field">
                            Format der Terminbilder
                            <select v-model="look.imageRatio" data-testid="theme-image-ratio">
                                <option v-for="r in RATIOS" :key="r.value" :value="r.value">{{ r.label }}</option>
                            </select>
                        </label>

                        <div class="actions">
                            <button
                                class="d-btn d-btn--primary"
                                type="button"
                                :disabled="!dirty || status === 'saving'"
                                data-testid="theme-save"
                                @click="save"
                            >
                                {{ status === 'saving' ? 'Speichere …' : 'Speichern' }}
                            </button>
                            <button class="d-btn" type="button" :disabled="!dirty" @click="look = { ...saved }">Verwerfen</button>
                            <span v-if="status === 'saved' && !dirty" class="ok" data-testid="theme-saved">
                                Gespeichert – die Fernseher zeigen es in etwa 20 s.
                            </span>
                        </div>
                        <p v-if="message" class="d-banner d-banner--error" role="alert">
                            {{ message }}
                            <button v-if="status === 'conflict'" class="d-btn" type="button" @click="reload">Neu laden</button>
                        </p>
                    </section>

                    <section class="preview" aria-label="Vorschau">
                        <div :ref="observe" class="preview-box" data-testid="theme-preview">
                            <StageView v-if="previewWidth" :width="STAGE.width" :height="STAGE.height" :fit="fit">
                                <SlideView :slide="previewSlide" :width="STAGE.width" :height="STAGE.height" />
                            </StageView>
                        </div>
                        <p class="hint">Vorschau mit echten Terminen der ersten Kalender.</p>
                    </section>
                </div>
            </ModulePage>
        </template>
        <p v-else class="page-message muted">Lade …</p>
    </div>
</template>

<style scoped>
.home {
    min-height: 100%;
}
.page-message {
    margin: 24px 16px;
}
.page-title {
    display: flex;
    align-items: center;
    gap: 12px;
}
.page-title h1 {
    margin: 0;
    font-size: 1.8em;
}
.title-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--d-radius-lg);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.intro {
    max-width: 75ch;
    margin: -8px 0 0;
}
.muted {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.layout {
    display: grid;
    grid-template-columns: minmax(280px, 360px) 1fr;
    gap: 20px;
    align-items: start;
}
.settings {
    display: grid;
    gap: 16px;
    padding: 16px 18px;
}
fieldset {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
}
legend {
    margin-bottom: 6px;
    font-weight: 700;
}
.choice {
    grid-template-columns: 1fr 1fr;
}
.choice legend {
    grid-column: 1 / -1;
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
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
.ok {
    color: var(--d-success);
    font-size: var(--d-size-sm);
}
.preview {
    display: grid;
    gap: 6px;
    position: sticky;
    top: 12px;
}
.preview-box {
    position: relative;
    overflow: hidden;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--d-radius-lg);
    background: var(--d-text);
}
@media (max-width: 60rem) {
    .layout {
        grid-template-columns: 1fr;
    }
    .preview {
        position: static;
        order: -1;
    }
}
@media (max-width: 48rem) {
    .page-title h1 {
        font-size: 1.4em;
    }
    .title-icon {
        display: none;
    }
}
</style>
