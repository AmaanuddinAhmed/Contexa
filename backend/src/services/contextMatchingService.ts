import { IProfile } from "../models/Profile.js";
import { IContext } from "../models/Context.js";
import {
    calculateProfileSimilarity
} from "./profileMatchingService.js";

const normalize = (value: string): string =>
    value.trim().toLowerCase();

const arraySimilarity = (
    first: string[],
    second: string[]
): number => {
    if (!first.length || !second.length) {
        return 0;
    }

    const firstSet = new Set(first.map(normalize));
    const secondSet = new Set(second.map(normalize));

    let intersection = 0;

    for (const item of firstSet) {
        if (secondSet.has(item)) {
            intersection++;
        }
    }

    const union = new Set([
        ...firstSet,
        ...secondSet
    ]).size;

    return union === 0 ? 0 : intersection / union;
};

const textSimilarity = (
    first: string,
    second: string
): number => {
    const firstWords = normalize(first)
        .split(/\s+/)
        .filter(Boolean);

    const secondWords = normalize(second)
        .split(/\s+/)
        .filter(Boolean);

    return arraySimilarity(firstWords, secondWords);
};

const interactionSimilarity = (
    first: string,
    second: string
): number => {
    const a = normalize(first);
    const b = normalize(second);

    if (a === b || a === "either" || b === "either") {
        return 1;
    }

    return 0;
};

const needFulfillment = (
    needs: string[],
    profile: IProfile
): number => {
    if (!needs.length) {
        return 0;
    }

    const capabilities = new Set(
        [
            ...profile.skills,
            ...profile.interests
        ].map(normalize)
    );

    let fulfilled = 0;

    for (const need of needs) {
        const normalizedNeed = normalize(need);

        if (capabilities.has(normalizedNeed)) {
            fulfilled++;
        }
    }

    return fulfilled / needs.length;
};

export interface ContextMatchResult {
    score: number;
    breakdown: {
        profile: number;
        need: number;
        activity: number;
        availability: number;
        interactionPreference: number;
        needFulfillmentA: number;
        needFulfillmentB: number;
    };
}

export const calculateContextCompatibility = (
    profileA: IProfile,
    profileB: IProfile,
    contextA: IContext,
    contextB: IContext
): ContextMatchResult => {
    const profile = calculateProfileSimilarity(
        profileA,
        profileB
    );

    const need = arraySimilarity(
        contextA.need,
        contextB.need
    );

    const activity = textSimilarity(
        contextA.activity,
        contextB.activity
    );

    const availability = textSimilarity(
        contextA.availability,
        contextB.availability
    );

    const interactionPreference = interactionSimilarity(
        contextA.interactionPreference,
        contextB.interactionPreference
    );

    const needFulfillmentA = needFulfillment(
        contextA.need,
        profileB
    );

    const needFulfillmentB = needFulfillment(
        contextB.need,
        profileA
    );

    const complementarity =
        (needFulfillmentA + needFulfillmentB) / 2;

    const score =
        profile.score * 0.30 +
        need * 0.10 +
        activity * 0.05 +
        availability * 0.05 +
        interactionPreference * 0.05 +
        complementarity * 0.45;

    return {
        score: Number(score.toFixed(4)),
        breakdown: {
            profile: profile.score,
            need: Number(need.toFixed(4)),
            activity: Number(activity.toFixed(4)),
            availability: Number(availability.toFixed(4)),
            interactionPreference,
            needFulfillmentA: Number(
                needFulfillmentA.toFixed(4)
            ),
            needFulfillmentB: Number(
                needFulfillmentB.toFixed(4)
            )
        }
    };
};