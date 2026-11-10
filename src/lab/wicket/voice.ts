import type { DaySummary } from "../../lib/daily.ts"

export interface TicketCopy {
    // Printed on the flap, the way a real ticket says "Adult All-Day".
    kind: string
    // The joke. Never shown next to alerts or avalanche content.
    fine: string
    // The microprint up the ticket's edge.
    edge: string
}

const edge = "Void on bad days."

// Thunderstorms get plain words: a joke on a day with hail and sirens reads badly however it's written.
export function ticketCopy(text: string, day?: DaySummary, temperature?: number): TicketCopy {
    const t = text.toLowerCase()
    const heat = day?.high ?? temperature ?? 0
    const cold = day?.high ?? temperature ?? 99

    if (/thunder|t-?storm|tornado/.test(t)) {
        return {
            kind: "Forecast ticket",
            fine: "Issued for information only. Check the alerts and the sky before you go.",
            edge: "Subject to weather.",
        }
    }
    if (day?.highlight === "pow") {
        return {
            kind: "All-mountain pass",
            edge,
            fine: "Non-transferable. Void if it stops snowing. Management is not responsible for sick days taken.",
        }
    }
    if (day?.highlight === "primo") {
        return {
            kind: "Primo day pass",
            edge,
            fine: "Not valid on bad days, and today isn't one. Sunscreen sold separately. Goggle tan is non-refundable.",
        }
    }
    if (/snow|flurr|sleet|wintry/.test(t) || (day?.snow ?? 0) >= 1) {
        return {
            kind: "Snow day pass",
            edge,
            fine: "Good for one day of snow. Not valid in the lodge. Your boss does not need to know.",
        }
    }
    if (heat >= 95) {
        return {
            kind: "Shade pass",
            edge,
            fine: "Admits one to shade, pool, or the nearest air conditioning. Not valid outdoors from noon to six. Bring water.",
        }
    }
    if (/rain|shower|drizzle/.test(t)) {
        return {
            kind: "Rain check",
            edge,
            fine: "Not valid on bad days. Today may qualify. Rain check redeemable for nothing, but thanks for asking.",
        }
    }
    if (/fog|mist|haze|smoke/.test(t)) {
        return {
            kind: "Low-vis pass",
            edge,
            fine: "Valid wherever visible. Holder assumes all responsibility for trees.",
        }
    }
    if (cold <= 15) {
        return {
            kind: "Face-numbing pass",
            edge,
            fine: "Holder's face not covered under warranty. Hot chocolate sold separately.",
        }
    }
    if (/cloudy/.test(t)) {
        return {
            kind: "Flat-light pass",
            edge,
            fine: "Not valid on bad days. Management declines to say whether this is one.",
        }
    }
    return {
        kind: "Full-day pass",
        edge,
        fine: "Valid until sundown or sunburn, whichever comes first. Report to the outdoors immediately.",
    }
}
