import { Profile, IProfile } from "../models/Profile.js";

const EXPERIENCE_LEVELS = {
    Beginner: 1,
    Intermediate: 2,
    Advanced: 3
} as const;

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

const experienceSimilarity = (
    first: string | undefined,
    second: string | undefined
): number => {
    if (!first || !second) {
        return 0;
    }

    const firstLevel =
        EXPERIENCE_LEVELS[
        first as keyof typeof EXPERIENCE_LEVELS
        ];

    const secondLevel =
        EXPERIENCE_LEVELS[
        second as keyof typeof EXPERIENCE_LEVELS
        ];

    if (!firstLevel || !secondLevel) {
        return 0;
    }

    const difference = Math.abs(firstLevel - secondLevel);

    return 1 - difference / 2;
};

export interface ProfileMatchResult {
    score: number;
    breakdown: {
        skills: number;
        interests: number;
        experience: number;
        collaborationPreferences: number;
    };
}

export const calculateProfileSimilarity = (
    first: IProfile,
    second: IProfile
): ProfileMatchResult => {
    const skills = arraySimilarity(
        first.skills,
        second.skills
    );

    const interests = arraySimilarity(
        first.interests,
        second.interests
    );

    const experience = experienceSimilarity(
        first.experienceLevel,
        second.experienceLevel
    );

    const collaborationPreferences = arraySimilarity(
        first.collaborationPreferences ?? [],
        second.collaborationPreferences ?? []
    );

    const score =
        skills * 0.4 +
        interests * 0.3 +
        experience * 0.15 +
        collaborationPreferences * 0.15;

    return {
        score: Number(score.toFixed(4)),
        breakdown: {
            skills: Number(skills.toFixed(4)),
            interests: Number(interests.toFixed(4)),
            experience: Number(experience.toFixed(4)),
            collaborationPreferences: Number(
                collaborationPreferences.toFixed(4)
            )
        }
    };
};