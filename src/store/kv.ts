/**
 * The one seam between this extension and the ChurchTools KV store
 * (Plan.md, Risiko 5). It mirrors the API one to one – module → category →
 * value, values are opaque strings without name or version (G3, G11) – so
 * that the in-memory mock and the real store are interchangeable.
 */
export interface KvCategory {
    id: number;
    shorty: string;
    name: string;
}

export interface KvValue {
    id: number;
    value: string;
}

export interface KvBackend {
    listCategories(): Promise<KvCategory[]>;
    createCategory(category: { shorty: string; name: string; description: string }): Promise<KvCategory>;
    /** There is no filter: a category is always read as a whole. */
    listValues(categoryId: number): Promise<KvValue[]>;
    createValue(categoryId: number, value: string): Promise<KvValue>;
    /** Replaces the value completely; there is no ETag and no version check (G3). */
    updateValue(categoryId: number, valueId: number, value: string): Promise<void>;
    deleteValue(categoryId: number, valueId: number): Promise<void>;
}
