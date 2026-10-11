let fallbackId = 0;

/** Give restored source rows durable, distinct identities without changing rates. */
export function normalizeSourceIds(records) {
    if (!Array.isArray(records)) return [];
    const ids = new Set();
    return records.map(record => {
        const source = record && typeof record === 'object' && !Array.isArray(record)
            ? {...record}
            : {target_item: '', output_per_minute: 0, migration_error: '保存的来源格式不正确', original_record: record};
        let id = typeof source.id === 'string' ? source.id.trim() : '';
        if (!id || ids.has(id)) {
            do {
                id = globalThis.crypto?.randomUUID?.() || `restored-source-${Date.now()}-${++fallbackId}`;
            } while (ids.has(id));
        }
        ids.add(id);
        return {...source, id};
    });
}
