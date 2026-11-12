import { describe, expect, it } from "vitest"

import { clientKey } from "./clientKey.ts"

describe("clientKey", () => {
    it("keys an IPv4 caller by its address", () => {
        expect(clientKey("203.0.113.7")).toBe("203.0.113.7")
        expect(clientKey("0.0.0.0")).toBe("0.0.0.0")
    })

    it("keys an IPv6 caller by its /64", () => {
        expect(clientKey("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64")
        expect(clientKey("2001:0DB8:0001:0002:ffff:ffff:ffff:ffff")).toBe("2001:db8:1:2::/64")
        expect(clientKey("2001:db8::1")).toBe("2001:db8:0:0::/64")
        expect(clientKey("::1")).toBe("0:0:0:0::/64")
        expect(clientKey("fe80::1%eth0")).toBe("fe80:0:0:0::/64")
    })

    it("gives every address in a /64 the same key", () => {
        expect(clientKey("2001:db8:aa:bb::1")).toBe(clientKey("2001:db8:aa:bb:ffff:1:2:3"))
        expect(clientKey("2001:db8:aa:bb::1")).not.toBe(clientKey("2001:db8:aa:bc::1"))
    })

    it("keys an IPv4 address written in IPv6 form as the IPv4 address", () => {
        expect(clientKey("::ffff:203.0.113.7")).toBe("203.0.113.7")
        expect(clientKey("::ffff:cb00:7107")).toBe("203.0.113.7")
    })

    it("rejects anything that isn't an IP address", () => {
        for (const address of [
            null,
            undefined,
            "",
            "unknown",
            "203.0.113",
            "203.0.113.256",
            "203.0.113.07",
            "203.0.113.7:443",
            "1:2:3:4:5:6:7",
            "1:2:3:4:5:6:7:8:9",
            "1::2::3",
            "1:2:3:4:5:6:7:8::",
            "12345::",
            "g::1",
            "::ffff:203.0.113.256",
            "203.0.113.7::1",
        ]) {
            expect(clientKey(address)).toBeUndefined()
        }
    })
})
