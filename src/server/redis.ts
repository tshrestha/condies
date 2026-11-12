/// <reference types="node" />

import "server-only"

import { createClient } from "redis"

// Bounds each Redis call, including connecting, so a hung connection fails the request instead of holding it open.
const timeoutMs = 2_000
const cacheTTLSeconds = 200 * 60 * 60

function newClient() {
    const address = process.env.db_address
    if (!address) {
        throw new Error("db_address is not set")
    }
    const colon = address.lastIndexOf(":")
    return createClient({
        username: process.env.db_username,
        password: process.env.db_password,
        socket: {
            host: colon < 0 ? address : address.slice(0, colon),
            port: colon < 0 ? 6379 : Number(address.slice(colon + 1)),
            connectTimeout: timeoutMs,
            // A request shouldn't wait out a retry. The next one connects again.
            reconnectStrategy: false,
        },
        // Fails commands at once while disconnected, rather than queueing them.
        disableOfflineQueue: true,
    })
}

type Client = ReturnType<typeof newClient>

let connection: Promise<Client> | undefined

// Function instances share no memory, so the cache and the rate-limit counters live in Redis. A warm instance reuses
// its connection, and opens a new one on the next request after that connection drops.
function redis(): Promise<Client> {
    if (connection) {
        return connection
    }
    const client = newClient()
    const opened = client.connect()
    const forget = () => {
        if (connection === opened) {
            connection = undefined
        }
    }
    client.on("error", (error) => console.error("redis connection error", error))
    client.on("terminated", forget)
    opened.catch(forget)
    connection = opened
    return opened
}

async function withTimeout<T>(run: (client: Client) => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`redis call took longer than ${timeoutMs}ms`)), timeoutMs)
    })
    try {
        return await Promise.race([redis().then(run), timeout])
    } finally {
        clearTimeout(timer)
    }
}

export async function getCached(key: string): Promise<string | undefined> {
    return (await withTimeout((client) => client.get(key))) ?? undefined
}

export async function setCached(key: string, value: string): Promise<void> {
    await withTimeout((client) => client.set(key, value, { expiration: { type: "EX", value: cacheTTLSeconds } }))
}

// Adds one to the counter at key, and returns the count so far.
export async function countRequest(key: string, ttlSeconds: number): Promise<number> {
    const [count] = await withTimeout((client) => client.multi().incr(key).expire(key, ttlSeconds).exec())
    return Number(count)
}
