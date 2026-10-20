import { computed, inject, onBeforeUnmount, provide, ref, shallowRef, watch, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { t } from '../../i18n/designer';
import { IN_QUICK_FIELD, useInspectorMode } from '../inspector/mode';
import { hasHelp, type HelpItem, type HelpSection, type HelpTopic } from './types';

/** The id of the topic for loose settings that stand in no section (Plan.md 98). */
export const GENERAL_ID = 'general';

/** A section that has announced itself: where it stands in the page, and getters so the topic follows the section's props. */
interface Entry {
    id: string;
    el: HTMLElement;
    title: () => string;
    topic: () => HelpTopic | undefined;
}

export interface HelpRegister {
    /** The topics in the order of the inspector, "Allgemein" first when it has entries. */
    sections: ComputedRef<HelpSection[]>;
    /** What the help is about: the name of the block, "Folie", or the page. */
    subject: ComputedRef<string>;
    open: Ref<boolean>;
    active: Ref<string>;
    /** Whether the bar is open on this topic. */
    shown(id: string): boolean;
    /** The "?" of a section: open on it, close if already open there, else switch to it. */
    toggle(id: string): void;
    /** The "?" of the head: the same for the first topic. */
    toggleStart(): void;
    /** Whether the bar is open on the first topic. */
    startShown: ComputedRef<boolean>;
    close(): void;
    addSection(entry: Entry): () => void;
    addGeneral(items: () => HelpItem[]): () => void;
}

export const HELP_REGISTER: InjectionKey<HelpRegister> = Symbol('help-register');

/** Document order of two registered sections; a pair the browser cannot place keeps the order of registering. */
function byPosition(a: Entry, b: Entry): number {
    const position = a.el.compareDocumentPosition(b.el);
    if (position & Node.DOCUMENT_POSITION_DISCONNECTED) return 0;
    return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0;
}

/** The register a page provides (Plan.md 98): `subject` names what the help is about. */
export function createHelpRegister(subject: () => string): HelpRegister {
    const entries = shallowRef<Entry[]>([]);
    const general = shallowRef<Array<() => HelpItem[]>>([]);
    const open = ref(false);
    const active = ref(GENERAL_ID);

    const sections = computed<HelpSection[]>(() => {
        const found: HelpSection[] = [];
        const items = general.value.flatMap((get) => get());
        if (items.length) found.push({ id: GENERAL_ID, title: t.help.general, topic: { items } });
        for (const entry of [...entries.value].sort(byPosition)) {
            const topic = entry.topic();
            if (hasHelp(topic)) found.push({ id: entry.id, title: entry.title(), topic });
        }
        return found;
    });
    const start = computed(() => sections.value[0]?.id ?? null);

    function shown(id: string): boolean {
        return open.value && active.value === id;
    }
    function toggle(id: string): void {
        if (shown(id)) {
            open.value = false;
            return;
        }
        active.value = id;
        open.value = true;
    }

    // The selection changes: the bar follows. Without the open topic it takes the first, without any it closes.
    watch(
        sections,
        (list) => {
            if (!open.value) return;
            if (!list.length) open.value = false;
            else if (!list.some((s) => s.id === active.value)) active.value = list[0]!.id;
        },
        { flush: 'post' },
    );

    return {
        sections,
        subject: computed(subject),
        open,
        active,
        shown,
        toggle,
        toggleStart: () => {
            if (start.value) toggle(start.value);
        },
        startShown: computed(() => !!start.value && shown(start.value)),
        close: () => {
            open.value = false;
        },
        addSection(entry) {
            entries.value = [...entries.value, entry];
            return () => {
                entries.value = entries.value.filter((e) => e !== entry);
            };
        },
        addGeneral(items) {
            general.value = [...general.value, items];
            return () => {
                general.value = general.value.filter((g) => g !== items);
            };
        },
    };
}

/** Provides a register to everything below the calling page. */
export function provideHelp(subject: () => string): HelpRegister {
    const register = createHelpRegister(subject);
    provide(HELP_REGISTER, register);
    return register;
}

/** The register of the page, or null in a unit test or a dialog: then everything about the help does nothing. */
export function useHelp(): HelpRegister | null {
    return inject(HELP_REGISTER, null);
}

/**
 * Loose explanations of a block's inspector (settings that stand in no section) go to the topic "Allgemein" as long as the
 * caller is mounted. Not in the short menu or its chips: only the inspector announces itself.
 */
export function useGeneralHelp(items: () => HelpItem[]): void {
    const register = useHelp();
    if (!register) return;
    const mode = useInspectorMode();
    const inChip = inject(IN_QUICK_FIELD, ref(false));
    // `watch`, not `watchEffect`: adding reads the list it writes, which an effect would take for its own dependency.
    watch(
        () => mode.value === 'full' && !inChip.value,
        (full, _, onCleanup) => {
            if (full) onCleanup(register.addGeneral(items));
        },
        { immediate: true },
    );
}

/** Announces a section's topic as long as its element exists; the getters keep it current. Returns nothing – it cleans up itself. */
export function useHelpSection(el: Ref<HTMLElement | null>, id: () => string, title: () => string, topic: () => HelpTopic | undefined): void {
    const register = useHelp();
    if (!register) return;
    let remove: (() => void) | null = null;
    watch(
        el,
        (element) => {
            remove?.();
            remove = element ? register.addSection({ id: id(), el: element, title, topic }) : null;
        },
        { flush: 'post' },
    );
    onBeforeUnmount(() => remove?.());
}
