import { createRouter, createWebHistory } from 'vue-router';
import DesignerHome from './views/DesignerHome.vue';
import PlaylistEditor from './views/PlaylistEditor.vue';
import PlaylistsView from './views/PlaylistsView.vue';
import SchedulesView from './views/SchedulesView.vue';
import NoticesView from './views/NoticesView.vue';
import PlayerView from './views/PlayerView.vue';
import NotFoundView from './views/NotFoundView.vue';
import SetupView from './views/SetupView.vue';
import MediaView from './views/MediaView.vue';
import DesignView from './views/DesignView.vue';
import AboutView from './views/AboutView.vue';

// No lazy routes: a kiosk tab open for weeks would request a chunk that a
// later extension update has deleted (Plan.md, Risiko 7).
export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        { path: '/', name: 'designer', component: DesignerHome },
        // The editor hangs on a playlist, which screens choose (schema 1.4, Plan.md 19).
        { path: '/zeitplaene', name: 'schedules', component: SchedulesView },
        // Prominent on its own, not buried in the playlist inspector (Plan.md, Nächste Schritte 34).
        { path: '/hinweise', name: 'notices', component: NoticesView },
        { path: '/playlists', name: 'playlists', component: PlaylistsView },
        { path: '/playlists/:id', name: 'editor', component: PlaylistEditor },
        { path: '/player', name: 'player', component: PlayerView },
        { path: '/mediathek', name: 'media', component: MediaView },
        { path: '/design', name: 'design', component: DesignView },
        { path: '/ueber', name: 'about', component: AboutView },
        { path: '/einstellungen', name: 'setup', component: SetupView },
        // The first name of the page (until 2026-09-24); links to it keep working.
        { path: '/einrichtung', redirect: (to) => ({ name: 'setup', hash: to.hash }) },
        // On a foyer TV an empty page is indistinguishable from a crash (G7).
        { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
    ],
});
