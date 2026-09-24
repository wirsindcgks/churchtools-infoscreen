import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

export default defineConfigWithVueTs(
    { ignores: ['dist/**', 'releases/**', 'fixtures/**', 'test-results/**', 'playwright-report/**'] },
    pluginVue.configs['flat/recommended'],
    vueTsConfigs.recommended,
    {
        rules: {
            'vue/multi-word-component-names': 'off',
            'vue/html-indent': ['error', 4],
            'vue/max-attributes-per-line': 'off',
            'vue/singleline-html-element-content-newline': 'off',
        },
    },
);
