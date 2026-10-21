/**
 * The sentences of the page "Verlauf" (Plan.md 100): one entry of the changelog in words. The designer writes the details
 * as short keys with a value (`changed:Begrüßung`), so the page words them and the stored entry stays the same in any language.
 */
import { t } from '../i18n/designer';
import type { ChangeDoc } from '../model/schema';

const s = t.history.sentence;

/** The values of the details with this key, in order. */
function detailsOf(doc: ChangeDoc, key: string): string[] {
    return (doc.details ?? []).filter((d) => d.startsWith(`${key}:`)).map((d) => d.slice(key.length + 1));
}

export interface ChangeLine {
    /** The sentence: `„Foyer“ veröffentlicht: 2 Folien geändert, 1 neu`. */
    text: string;
    /** The names of the slides named in the details, or ''. */
    names: string;
}

export function describeChange(doc: ChangeDoc): ChangeLine {
    const name = doc.targetName;
    const changed = detailsOf(doc, 'changed');
    const added = detailsOf(doc, 'added');
    const removed = Number(detailsOf(doc, 'removed')[0] ?? 0);
    const names = [...changed, ...added].filter((n) => n !== '').join(', ');
    const more = Number(detailsOf(doc, 'more')[0] ?? 0);
    const namesLine = more ? `${names}, ${s.more(more)}` : names;

    if (doc.action === 'published') {
        const parts = [
            ...(changed.length ? [s.slidesChanged(changed.length)] : []),
            ...(added.length ? [s.slidesAdded(added.length)] : []),
            ...(removed ? [s.slidesRemoved(removed)] : []),
        ];
        return { text: parts.length ? `${s.published(name)}: ${parts.join(', ')}` : s.published(name), names: namesLine };
    }
    if (doc.action === 'duplicated') return { text: s.duplicated(name, detailsOf(doc, 'source')[0] ?? null), names: '' };
    if (doc.action === 'banners') {
        return { text: detailsOf(doc, 'banner')[0] === 'set' ? s.bannerSet(name) : s.bannerCleared(name), names: '' };
    }
    if (doc.action === 'schedule') {
        const rules = detailsOf(doc, 'rules')[0];
        return { text: rules === undefined ? s.schedule(name) : `${s.schedule(name)}: ${s.scheduleRules(Number(rules))}`, names: '' };
    }
    if (doc.action === 'settings' && doc.area === 'screen') {
        const old = detailsOf(doc, 'renamed')[0];
        const parts = [...(old === undefined ? [] : [s.renamed(old)]), ...((doc.details ?? []).includes('overscan') ? [s.overscan] : [])];
        return { text: parts.length ? `${s.screenSettings(name)}: ${parts.join(', ')}` : s.screenSettings(name), names: '' };
    }
    if (doc.area === 'theme') return { text: s.theme, names: '' };
    if (doc.area === 'settings') return { text: s.settings, names: '' };
    if (doc.action === 'created') return { text: s.created(name), names: '' };
    if (doc.action === 'deleted') return { text: s.deleted(name), names: '' };
    if (doc.action === 'saved') return { text: s.saved(name), names: '' };
    return { text: s.unknown(name, doc.action), names: '' };
}
