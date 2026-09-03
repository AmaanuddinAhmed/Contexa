import { z } from "zod";

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});

export const profileSchema = z.object({
    name: z.string().min(1).max(100),
    bio: z.string().max(500).optional(),
    education: z.string().max(200).optional(),
    role: z.string().max(100).optional(),
    experienceLevel: z.string().max(50).optional(),
    skills: z.array(z.string()).default([]),
    interests: z.array(z.string()).default([]),
    collaborationPreferences: z.array(z.string()).default([]),
    visibility: z.enum(["public", "private"]).default("public")
});

export const contextSchema = z.object({
    goal: z.string().min(1).max(200),
    need: z.array(z.string()).default([]),
    activity: z.string().min(1).max(200),
    availability: z.string().min(1).max(100),
    situation: z.string().min(1).max(500),
    interactionPreference: z.string().min(1).max(100),
    validUntil: z.string().datetime().optional()
});