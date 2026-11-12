// Identifies a caller for rate limiting from the address Netlify's edge puts in x-nf-client-connection-ip.
// X-Forwarded-For isn't used because callers can add to it. Returns undefined for anything that isn't an IP address.
export function clientKey(address: string | null | undefined): string | undefined {
    if (!address) {
        return undefined
    }
    const v4 = parseIPv4(address)
    if (v4) {
        return v4.join(".")
    }

    const v6 = parseIPv6(address)
    if (!v6) {
        return undefined
    }
    // An IPv4 address written in IPv6 form (::ffff:a.b.c.d) counts as the IPv4 address.
    if (v6.slice(0, 5).every((part) => part === 0) && v6[5] === 0xffff) {
        return [v6[6] >> 8, v6[6] & 0xff, v6[7] >> 8, v6[7] & 0xff].join(".")
    }
    // A single IPv6 customer usually controls a whole /64.
    return `${v6
        .slice(0, 4)
        .map((part) => part.toString(16))
        .join(":")}::/64`
}

const octet = /^(0|[1-9]\d{0,2})$/

function parseIPv4(address: string): number[] | undefined {
    const parts = address.split(".")
    if (parts.length !== 4 || !parts.every((part) => octet.test(part))) {
        return undefined
    }
    const octets = parts.map(Number)
    return octets.every((n) => n <= 255) ? octets : undefined
}

const hextet = /^[0-9a-f]{1,4}$/i

// Returns the address as its eight 16-bit parts.
function parseIPv6(address: string): number[] | undefined {
    // A zone (fe80::1%eth0) names the local interface, not the caller.
    const zone = address.indexOf("%")
    const bare = zone < 0 ? address : address.slice(0, zone)

    const halves = bare.split("::")
    if (halves.length > 2) {
        return undefined
    }
    const parse = (half: string, endsAddress: boolean) => {
        if (!half) {
            return []
        }
        const parts = half.split(":")
        const last = parts.at(-1)!
        // The address's last 32 bits can be written as an IPv4 address.
        const v4 = endsAddress && last.includes(".") ? parseIPv4(last) : undefined
        if (v4) {
            parts.splice(-1, 1, ((v4[0] << 8) | v4[1]).toString(16), ((v4[2] << 8) | v4[3]).toString(16))
        }
        return parts.every((part) => hextet.test(part)) ? parts.map((part) => parseInt(part, 16)) : undefined
    }

    const head = parse(halves[0], halves.length === 1)
    const tail = halves.length === 2 ? parse(halves[1], true) : []
    if (!head || !tail) {
        return undefined
    }
    if (halves.length === 1) {
        return head.length === 8 ? head : undefined
    }
    // "::" stands for one or more zero parts.
    const missing = 8 - head.length - tail.length
    return missing >= 1 ? [...head, ...Array<number>(missing).fill(0), ...tail] : undefined
}
