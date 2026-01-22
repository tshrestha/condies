export const savedSelectionsCollectionKey = "nawaSavedSelections"

export function getItem(key: string) {
    const serializedItem = localStorage.getItem(key)
    if (serializedItem) {
        return JSON.parse(serializedItem)
    }
    return null
}

export function setItem(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value))
}

export function addItem(collectionKey: string, item: any) {
    const serializedCollection = localStorage.getItem(collectionKey)
    let collection: any[]

    if (!serializedCollection) {
        collection = []
    } else {
        collection = JSON.parse(serializedCollection)
    }

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
    localStorage.setItem(collectionKey, JSON.stringify(collection))
}
