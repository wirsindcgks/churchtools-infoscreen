import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './designer/theme.css';
import { router } from './router';
import { configureClient } from './ct/client';
import { registerFonts } from './player/fonts';

configureClient();
registerFonts();

createApp(App).use(createPinia()).use(router).mount('#app');
