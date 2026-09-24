/** Key of this extension; the build serves under /ccm/<key>/ (vite.config.ts). */
export const EXTENSION_KEY: string = import.meta.env.BASE_URL.split('/').filter(Boolean).at(-1) ?? 'infoscreen-designer';
