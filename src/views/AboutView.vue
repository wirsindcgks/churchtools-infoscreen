<script setup lang="ts">
/**
 * "Über & Neuigkeiten" for everyone who uses the module: which version is
 * installed and what changed – CHANGELOG.md as it is, the same text as the
 * release notes on GitHub. Opening it clears the dot in the sidebar.
 */
import { onMounted } from 'vue';
import changelogText from '../../CHANGELOG.md?raw';
import { formatReleaseDate, parseChangelog, releaseOf, REPOSITORY_URL } from '../about/changelog';
import ChangelogInline from '../about/ChangelogInline.vue';
import { markReleaseSeen } from '../about/seen';
import { t } from '../i18n/designer';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';

const APP_VERSION = __APP_VERSION__;
const RELEASE = releaseOf(APP_VERSION);
const versions = parseChangelog(changelogText);

/** The installed release, and what came before it; changes after it are "in Arbeit". */
function label(version: string | null): string {
    if (version === null) return t.about.nextVersion;
    return t.about.version(version);
}

onMounted(markReleaseSeen);
</script>

<template>
    <ModulePage>
        <PageHeader icon="info" :title="t.about.title" testid="about-heading">
            {{ t.about.intro }}
        </PageHeader>

        <section class="d-card about" aria-labelledby="about-title">
            <h2 id="about-title">{{ t.common.moduleName }} <span class="version" data-testid="about-version">{{ APP_VERSION }}</span></h2>
            <p>{{ t.about.description }}</p>
            <ul class="links">
                <li><a :href="`${REPOSITORY_URL}/releases`" target="_blank" rel="noopener">{{ t.about.allVersions }}</a></li>
                <li><a :href="`${REPOSITORY_URL}/issues`" target="_blank" rel="noopener">{{ t.about.report }}</a></li>
                <li><a :href="`${REPOSITORY_URL}#readme`" target="_blank" rel="noopener">{{ t.about.source }}</a></li>
            </ul>
            <p class="muted">{{ t.about.license }}</p>
        </section>

        <section
            v-for="v in versions"
            :key="v.version ?? 'next'"
            class="d-card release"
            :aria-labelledby="`release-${v.version ?? 'next'}`"
            data-testid="about-release"
        >
            <header>
                <h2 :id="`release-${v.version ?? 'next'}`">{{ label(v.version) }}</h2>
                <span v-if="v.version === RELEASE" class="badge badge--installed">{{ t.about.installed }}</span>
                <span v-else-if="v.version === null" class="badge">{{ t.about.inProgress }}</span>
                <span v-if="v.date" class="muted">{{ formatReleaseDate(v.date) }}</span>
            </header>
            <p v-if="v.version === null" class="muted">
                {{ t.about.unreleased }}
            </p>
            <p v-for="(paragraph, i) in v.intro" :key="i" class="intro">
                <ChangelogInline :parts="paragraph" />
            </p>
            <div v-for="g in v.groups" :key="g.heading" class="group">
                <h3 v-if="g.heading">{{ g.heading }}</h3>
                <ul class="items">
                    <li v-for="(item, i) in g.items" :key="i">
                        <ChangelogInline :parts="item" />
                    </li>
                </ul>
            </div>
        </section>
    </ModulePage>
</template>

<style scoped>
.about,
.release {
    display: grid;
    gap: 10px;
    padding: 16px 20px;
}
h2 {
    margin: 0;
    font-size: 1.15em;
}
p {
    margin: 0;
}
.version {
    margin-left: 6px;
    color: var(--d-text-muted);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
}
.links {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
    margin: 0;
    padding: 0;
    list-style: none;
}
a {
    color: var(--d-accent-strong);
}
.muted {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.release header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
}
.badge {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--d-panel);
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    font-weight: 700;
}
.badge--installed {
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
.group {
    display: grid;
    gap: 6px;
}
h3 {
    margin: 4px 0 0;
    font-size: 1em;
}
.items {
    display: grid;
    gap: 6px;
    margin: 0;
    padding-left: 20px;
}
</style>
