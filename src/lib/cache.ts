export const savedSelectionsCollectionKey = "nawaSavedSelections"
export const condiesThemeKey = "condiesTheme"
export const lastLocationKey = "condiesLastLocation"
export const spotsKey = "condiesSpots"

const keptKeys = new Set([savedSelectionsCollectionKey, condiesThemeKey, lastLocationKey, spotsKey])

export function getItem(key: string) {
    try {
        const serializedItem = localStorage.getItem(key)
        return serializedItem ? JSON.parse(serializedItem) : null
    } catch {
        // Storage can be blocked and old entries can be unreadable. Either way there's nothing to use.
        return null
    }
}

export function setItem(key: string, value: any) {
    const serializedValue = JSON.stringify(value)
    try {
        localStorage.setItem(key, serializedValue)
    } catch {
        clearLookupsAndRetry(key, serializedValue)
    }
}

// Search and map lookups are only a cache, so they're the first thing to go when storage fills up.
function clearLookupsAndRetry(key: string, serializedValue: string) {
    try {
        Object.keys(localStorage)
            .filter((k) => !keptKeys.has(k))
            .forEach((k) => localStorage.removeItem(k))
        localStorage.setItem(key, serializedValue)
    } catch {
        // Storage is blocked or still full, so this value just won't be saved.
    }
}

export function addItem(collectionKey: string, item: any) {
    const collection: any[] = getItem(collectionKey) ?? []

    const byID = (c: any) => c.id === item.id
    const index = collection.findIndex(byID)
    if (index === -1) {
        collection.push(item)
    } else {
        collection.splice(index, 1)
        collection.push(item)
    }

    if (collection.length > 10) {
        collection.shift()
    }
    setItem(collectionKey, collection)
}
