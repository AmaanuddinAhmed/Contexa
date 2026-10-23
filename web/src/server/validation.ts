import "server-only";

import { z } from "zod";
import { MESSAGE_MAX_LENGTH } from "@/server/messages/rules";
import { MATCHERS, RECOMMENDATION_MODES } from "@/server/recommendations/modes";
import { REPORT_DETAILS_MAX, REPORT_REASONS } from "@/lib/safety";

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});

const MAX_TERMS = 30;
const MAX_TERM_LENGTH = 60;
const termList = z.array(z.string().trim().min(1).max(MAX_TERM_LENGTH)).max(MAX_TERMS).default([]);

export const profileSchema = z.object({
    name: z.string().min(1).max(100),
    bio: z.string().max(500).optional(),
    education: z.string().max(200).optional(),
    role: z.string().max(100).optional(),
    experienceLevel: z.string().max(50).optional(),
    skills: termList,
    interests: termList,
    collaborationPreferences: termList,
    visibility: z.enum(["public", "private"]).default("public")
});

export const contextSchema = z.object({
    goal: z.string().min(1).max(200),
    need: termList,
    activity: z.string().min(1).max(200),
    availability: z.string().min(1).max(100),
    situation: z.string().min(1).max(500),
    interactionPreference: z.string().min(1).max(100),
    validUntil: z
        .string()
        .datetime()
        .optional()
        .refine(
            (value) => value === undefined || new Date(value).getTime() > Date.now(),
            { message: "validUntil must be in the future." }
        )
});

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

export const connectionRequestSchema = z.object({
    recipientId: objectId,
    message: z.string().trim().max(300).optional(),
    // Set when the request is sent from the recommendations page.
    source: z
        .object({
            mode: z.enum(RECOMMENDATION_MODES),
            // Optional: requests sent before semantic matching existed omit it.
            matcher: z.enum(MATCHERS).optional(),
            rank: z.number().int().min(1).max(50),
            score: z.number().min(0).max(1)
        })
        .optional()
});

export const connectionActionSchema = z.object({
    action: z.enum(["accept", "decline"])
});

export const feedbackRatingsSchema = z.object({
    ratings: z
        .array(
            z.object({
                userId: objectId,
                rating: z.number().int().min(1).max(5)
            })
        )
        .min(1)
        .max(50)
});

export const messageSchema = z.object({
    body: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH)
});

// Message timestamps as returned by the API (ISO 8601). `after` polls for
// newer messages; `before` loads an older page of history.
export const messageQuerySchema = z
    .object({
        after: z.string().datetime().optional(),
        before: z.string().datetime().optional()
    })
    .refine((query) => !(query.after && query.before), {
        message: "Use either after or before, not both."
    });

export const locationSchema = z.object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180)
});

export const ghostModeSchema = z.object({
    ghost: z.boolean()
});


export const blockSchema = z.object({
    userId: objectId
});

export const reportSchema = z.object({
    userId: objectId,
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(REPORT_DETAILS_MAX).optional()
});

export const reportReviewSchema = z.object({
    status: z.literal("reviewed")
});

export const deleteAccountSchema = z.object({
    password: z.string().max(200).optional(),
    confirm: z.string().max(20).optional()
});