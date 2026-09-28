/**
 * Exports golden fixtures from the original TypeScript matching services so
 * the Python port can be checked for exact parity
 * (recommendation-service/tests/test_parity.py).
 *
 * No database needed. Deterministic: a fixed seed produces the same file
 * every run.
 *
 * Run from backend/:  npm run parity:export
 * Output:             ../data/parity/matching_parity.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { IProfile } from "./models/Profile.js";
import { IContext } from "./models/Context.js";
import { calculateProfileSimilarity } from "./services/profileMatchingService.js";
import { calculateContextCompatibility } from "./services/contextMatchingService.js";

const SEED = 20260928;
const PAIR_CASES = 400;
const RANKING_CASES = 20;
const CANDIDATES_PER_RANKING = 40;
const RANKING_LIMIT = 10;

// Mulberry32: small seeded PRNG so fixtures are reproducible.
const createRandom = (seed: number) => {
    let state = seed >>> 0;

    return (): number => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const random = createRandom(SEED);
const pick = <T>(items: readonly T[]): T =>
    items[Math.floor(random() * items.length)];
const pickMany = <T>(items: readonly T[], min: number, max: number): T[] => {
    const count = min + Math.floor(random() * (max - min + 1));
    return Array.from({ length: count }, () => pick(items));
};

// Case and whitespace variants on purpose, to exercise normalisation.
const SKILLS = [
    "React", "react ", " REACT", "Node.js", "MongoDB", "Python", "python",
    "Java", "UI Design", "Machine Learning", "Docker", "AWS", "Figma",
    "Frontend", "backend", "SQL"
] as const;
const INTERESTS = [
    "AI", "ai", "Web Development", "Cloud", "Startups", "Design",
    "Open Source", "Data Science", "Frontend", "Python"
] as const;
const COLLABORATION = [
    "Online", "online", "Project-based", "Mentorship", "Pair programming"
] as const;
// Includes values the engine must score as 0 (lowercase, unknown, empty).
const EXPERIENCE = [
    "Beginner", "Intermediate", "Advanced", "intermediate", "Expert", "",
    undefined
] as const;
const ACTIVITY_WORDS = [
    "building", "a", "web", "app", "studying", "for", "exams", "Hackathon",
    "project", "software", "designing", "UI"
] as const;
const AVAILABILITY = [
    "Weekends", "weekends", "Evenings", "weekday evenings", "Available today",
    "after 6pm", "Weekends and evenings", ""
] as const;
const INTERACTION = [
    "Online", "online ", "In-person", "Either", "EITHER", "Hybrid", ""
] as const;

const randomProfile = (): IProfile => {
    const profile: Record<string, unknown> = {
        skills: pickMany(SKILLS, 0, 6),
        interests: pickMany(INTERESTS, 0, 4),
        experienceLevel: pick(EXPERIENCE)
    };

    // Sometimes omit collaborationPreferences to exercise the default.
    if (random() < 0.85) {
        profile.collaborationPreferences = pickMany(COLLABORATION, 0, 3);
    }

    return profile as unknown as IProfile;
};

const randomContext = (): IContext => ({
    // Needs drawn from skills + interests so fulfilment is often non-zero;
    // duplicates are possible and intentional.
    need: pickMany([...SKILLS, ...INTERESTS], 0, 3),
    activity: pickMany(ACTIVITY_WORDS, 0, 5).join(pick([" ", "  ", " \t"])),
    availability: pick(AVAILABILITY),
    interactionPreference: pick(INTERACTION)
}) as unknown as IContext;

// Hand-written edge cases.
const tieRoundingSkills = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => `${prefix}${index}`);

const EDGE_CASES: { name: string; profileA: IProfile; profileB: IProfile; contextA: IContext; contextB: IContext }[] = [
    {
        // Same inputs as testComplementarity.ts (expected score 0.69).
        name: "controlled-complementarity",
        profileA: { skills: ["Python"], interests: [], experienceLevel: "Intermediate", collaborationPreferences: ["Project-based"] } as unknown as IProfile,
        profileB: { skills: ["React"], interests: [], experienceLevel: "Intermediate", collaborationPreferences: ["Project-based"] } as unknown as IProfile,
        contextA: { need: ["React"], activity: "Building a software project", availability: "Weekends", interactionPreference: "Online" } as unknown as IContext,
        contextB: { need: ["Python"], activity: "Building a software project", availability: "Weekends", interactionPreference: "Online" } as unknown as IContext
    },
    {
        // Jaccard = 1/32 = 0.03125, an exact rounding tie: JS gives 0.0313.
        name: "rounding-tie",
        profileA: { skills: ["shared", ...tieRoundingSkills("a", 15)], interests: [], collaborationPreferences: [] } as unknown as IProfile,
        profileB: { skills: ["shared", ...tieRoundingSkills("b", 16)], interests: [], collaborationPreferences: [] } as unknown as IProfile,
        contextA: { need: [], activity: "x", availability: "y", interactionPreference: "Online" } as unknown as IContext,
        contextB: { need: [], activity: "x", availability: "y", interactionPreference: "Online" } as unknown as IContext
    },
    {
        name: "all-empty",
        profileA: { skills: [], interests: [] } as unknown as IProfile,
        profileB: { skills: [], interests: [] } as unknown as IProfile,
        contextA: { need: [], activity: "", availability: "", interactionPreference: "" } as unknown as IContext,
        contextB: { need: [], activity: "", availability: "", interactionPreference: "" } as unknown as IContext
    },
    {
        // Duplicate needs count individually: 2 of 3 fulfilled.
        name: "duplicate-needs",
        profileA: { skills: ["Java"], interests: [], collaborationPreferences: [] } as unknown as IProfile,
        profileB: { skills: ["React"], interests: [], collaborationPreferences: [] } as unknown as IProfile,
        contextA: { need: ["React", " react", "Docker"], activity: "a", availability: "b", interactionPreference: "Either" } as unknown as IContext,
        contextB: { need: [], activity: "a", availability: "b", interactionPreference: "In-person" } as unknown as IContext
    }
];

type PairCase = {
    name: string;
    profileA: IProfile;
    profileB: IProfile;
    contextA: IContext;
    contextB: IContext;
    expected: {
        PROFILE_ONLY: ReturnType<typeof calculateProfileSimilarity>;
        CONTEXT_AWARE: ReturnType<typeof calculateContextCompatibility>;
    };
};

const buildPairCase = (
    name: string,
    profileA: IProfile,
    profileB: IProfile,
    contextA: IContext,
    contextB: IContext
): PairCase => ({
    name,
    profileA,
    profileB,
    contextA,
    contextB,
    expected: {
        PROFILE_ONLY: calculateProfileSimilarity(profileA, profileB),
        CONTEXT_AWARE: calculateContextCompatibility(profileA, profileB, contextA, contextB)
    }
});

const pairCases: PairCase[] = [
    ...EDGE_CASES.map((edge) =>
        buildPairCase(edge.name, edge.profileA, edge.profileB, edge.contextA, edge.contextB)
    ),
    ...Array.from({ length: PAIR_CASES }, (_, index) =>
        buildPairCase(`random-${index}`, randomProfile(), randomProfile(), randomContext(), randomContext())
    )
];

// Ranking cases mirror recommendationService: score all, stable sort by
// score (desc), take the top RANKING_LIMIT.
const rankingCases = Array.from({ length: RANKING_CASES }, (_, index) => {
    const requester = { profile: randomProfile(), context: randomContext() };
    const candidates = Array.from({ length: CANDIDATES_PER_RANKING }, (_, candidateIndex) => ({
        userId: `user-${index}-${candidateIndex}`,
        profile: randomProfile(),
        context: randomContext()
    }));

    const rank = (mode: "PROFILE_ONLY" | "CONTEXT_AWARE") =>
        candidates
            .map((candidate) => {
                const result = mode === "PROFILE_ONLY"
                    ? calculateProfileSimilarity(requester.profile, candidate.profile)
                    : calculateContextCompatibility(requester.profile, candidate.profile, requester.context, candidate.context);

                return { userId: candidate.userId, score: result.score, breakdown: result.breakdown };
            })
            .sort((first, second) => second.score - first.score)
            .slice(0, RANKING_LIMIT);

    return {
        name: `ranking-${index}`,
        limit: RANKING_LIMIT,
        requester,
        candidates,
        expected: {
            PROFILE_ONLY: rank("PROFILE_ONLY"),
            CONTEXT_AWARE: rank("CONTEXT_AWARE")
        }
    };
});

const outputDir = path.resolve(process.cwd(), "../data/parity");
const outputFile = path.join(outputDir, "matching_parity.json");

mkdirSync(outputDir, { recursive: true });
writeFileSync(
    outputFile,
    JSON.stringify(
        {
            description:
                "Golden outputs from the original TypeScript matching services. " +
                "Regenerate only if the matching algorithm intentionally changes.",
            seed: SEED,
            pairCases,
            rankingCases
        },
        null,
        2
    ) + "\n"
);

console.log(
    `Wrote ${pairCases.length} pair cases and ${rankingCases.length} ranking cases to ${outputFile}`
);