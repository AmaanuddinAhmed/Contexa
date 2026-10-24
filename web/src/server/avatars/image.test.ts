import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { avatarPath, googlePhotoAtSize, sniffImageType } from "./image";

const bytes = (...values: (number | string)[]) =>
    new Uint8Array(values.flatMap((value) =>
        typeof value === "string" ? [...value].map((char) => char.charCodeAt(0)) : [value]
    ));

describe("sniffImageType", () => {
    it("recognises JPEG, PNG and WebP from their first bytes", () => {
        assert.equal(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
        assert.equal(sniffImageType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0)), "image/png");
        assert.equal(sniffImageType(bytes("RIFF", 0, 0, 0, 0, "WEBP", "VP8 ")), "image/webp");
    });

    it("rejects other files, whatever they claim to be", () => {
        assert.equal(sniffImageType(bytes("GIF89a")), null);
        assert.equal(sniffImageType(bytes("<svg xmlns=")), null);
        assert.equal(sniffImageType(bytes("%PDF-1.7")), null);
        assert.equal(sniffImageType(bytes("RIFF", 0, 0, 0, 0, "WAVE")), null);
    });

    it("rejects empty and truncated files", () => {
        assert.equal(sniffImageType(new Uint8Array()), null);
        assert.equal(sniffImageType(bytes(0xff, 0xd8)), null);
        assert.equal(sniffImageType(bytes(0x89, "PNG")), null);
    });
});

describe("avatarPath", () => {
    it("changes when the picture changes, so caches never show an old one", () => {
        const first = avatarPath("u1", new Date("2026-10-20T10:00:00Z"));
        const second = avatarPath("u1", new Date("2026-10-20T10:00:01Z"));
        assert.match(first, /^\/api\/v1\/avatars\/u1\?v=\d+$/);
        assert.notEqual(first, second);
    });
});

describe("googlePhotoAtSize", () => {
    it("replaces Google's size option", () => {
        assert.equal(
            googlePhotoAtSize("https://lh3.googleusercontent.com/a/abc=s96-c"),
            "https://lh3.googleusercontent.com/a/abc=s256-c"
        );
    });

    it("adds one when missing", () => {
        assert.equal(
            googlePhotoAtSize("https://lh3.googleusercontent.com/a/abc"),
            "https://lh3.googleusercontent.com/a/abc=s256-c"
        );
    });
});