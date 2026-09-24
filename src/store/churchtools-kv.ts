/**
 * The KV store of a real ChurchTools instance.
 *
 * Unverified until Custom Modules are enabled on the test instance (T1):
 * paths and payloads follow the OpenAPI schemas of build 32882 and the
 * official boilerplate, but no request of this file has run yet.
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { KvBackend, KvCategory, KvValue } from './kv';

export interface CustomModule {
    id: number;
    shorty: string;
}

/**
 * The module of this extension, looked up by its key. `GET /custommodules/{id}`
 * takes the numeric id only – a key answers 400 "validation.integer", measured
 * on build 32882 right after Custom Modules were enabled. So: list, then match.
 */
export async function findCustomModule(extensionKey: string): Promise<CustomModule | null> {
    const modules = await churchtoolsClient.get<CustomModule[]>('/custommodules');
    return modules.find((m) => m.shorty === extensionKey) ?? null;
}

export class ChurchToolsKv implements KvBackend {
    private moduleId: Promise<number> | null = null;

    constructor(private readonly extensionKey: string) {}

    async listCategories(): Promise<KvCategory[]> {
        return churchtoolsClient.get<KvCategory[]>(`${await this.base()}/customdatacategories`);
    }

    async createCategory(category: { shorty: string; name: string; description: string }): Promise<KvCategory> {
        const customModuleId = await this.resolveModuleId();
        return churchtoolsClient.post<KvCategory>(`${await this.base()}/customdatacategories`, {
            customModuleId,
            ...category,
        });
    }

    async listValues(categoryId: number): Promise<KvValue[]> {
        return churchtoolsClient.get<KvValue[]>(await this.valuesPath(categoryId));
    }

    async createValue(categoryId: number, value: string): Promise<KvValue> {
        return churchtoolsClient.post<KvValue>(await this.valuesPath(categoryId), { dataCategoryId: categoryId, value });
    }

    async updateValue(categoryId: number, valueId: number, value: string): Promise<void> {
        await churchtoolsClient.put(`${await this.valuesPath(categoryId)}/${valueId}`, {
            dataCategoryId: categoryId,
            value,
        });
    }

    async deleteValue(categoryId: number, valueId: number): Promise<void> {
        await churchtoolsClient.deleteApi(`${await this.valuesPath(categoryId)}/${valueId}`);
    }

    private async base(): Promise<string> {
        return `/custommodules/${await this.resolveModuleId()}`;
    }

    private async valuesPath(categoryId: number): Promise<string> {
        return `${await this.base()}/customdatacategories/${categoryId}/customdatavalues`;
    }

    private resolveModuleId(): Promise<number> {
        this.moduleId ??= findCustomModule(this.extensionKey)
            .then((module) => {
                if (!module) throw new Error(`Das Custom Module „${this.extensionKey}" ist nicht installiert.`);
                return module.id;
            })
            .catch((error: unknown) => {
                this.moduleId = null;
                throw error;
            });
        return this.moduleId;
    }
}
