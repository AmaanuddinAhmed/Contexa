/**
 * Generates 100 synthetic users, each with a profile and an active context.
 *
 * - Reproducible: faker is seeded, so every run creates the same people
 *   (override with SYNTHETIC_SEED=<number>).
 * - Safe: removes only previous synthetic users (@synthetic.contexa.local)
 *   and their own profiles/contexts. Real accounts are never touched.
 * - Writes retrieval terms for new users and backfills them for everyone.
 *
 * Run from frontend/:  npm run db:seed
 */
import { faker } from "@faker-js/faker";
import mongoose from "mongoose";
import { hashPassword } from "../src/server/auth";
import { Context } from "../src/server/models/Context";
import { Profile } from "../src/server/models/Profile";
import { User } from "../src/server/models/User";
import { toMatchTerms } from "../src/server/recommendations/terms";
import { backfillMatchTerms } from "./lib/backfillMatchTerms";
import { connectForScript } from "./lib/database";

const SYNTHETIC_USER_COUNT = 100;
const SYNTHETIC_EMAIL_DOMAIN = "@synthetic.contexa.local";
const DEFAULT_SEED = 20260928;

// >>> PASTE the vocabulary arrays from backend/src/seed.ts here
//     (skills, interests, goals, activities, availabilityOptions,
//      situations, interactionPreferences) 
const skills = [
    "Java",
    "Python",
    "JavaScript",
    "TypeScript",
    "React",
    "Node.js",
    "MongoDB",
    "SQL",
    "Machine Learning",
    "Data Analysis",
    "UI/UX",
    "Figma",
    "AWS",
    "Docker",
    "Cybersecurity"
];

const interests = [
    "Artificial Intelligence",
    "Web Development",
    "Cloud Computing",
    "Data Science",
    "Cybersecurity",
    "Mobile Development",
    "UI/UX Design",
    "Open Source",
    "Research",
    "Entrepreneurship"
];

const goals = [
    "Find a project partner",
    "Find a study partner",
    "Build a software project",
    "Learn a new technology",
    "Find someone to collaborate with",
    "Get help with a technical problem",
    "Work on a research project"
];

const activities = [
    "Working on an academic project",
    "Preparing for exams",
    "Building a personal project",
    "Learning a new technology",
    "Working on research",
    "Preparing for placements",
    "Working on a startup idea"
];

const availabilityOptions = [
    "Weekday evenings",
    "Weekends",
    "Weekday mornings",
    "Flexible",
    "After college hours"
];

const situations = [
    "I am looking for someone with complementary technical skills.",
    "I want to collaborate with someone who has similar interests.",
    "I need help completing a technical project.",
    "I want to learn by working with another person.",
    "I am looking for someone interested in building something together."
];

const interactionPreferences = [
    "Online",
    "In-person",
    "Either"
];

const randomItems = <T>(items: T[], min: number, max: number): T[] => {
    const count = faker.number.int({ min, max });

    return faker.helpers.shuffle(items).slice(0, count);
};

const seed = async (): Promise<void> => {
    await connectForScript();

    const seedValue = Number(process.env.SYNTHETIC_SEED ?? DEFAULT_SEED);
    faker.seed(seedValue);

    // Build all indexes before writing, rather than concurrently with inserts.
    await Promise.all([User.init(), Profile.init(), Context.init()]);

    console.log("Removing previous synthetic users and their data...");

    const syntheticUserIds = await User.find({
        email: { $regex: /@synthetic\.contexa\.local$/ }
    }).distinct("_id");

    await Context.deleteMany({ userId: { $in: syntheticUserIds } });
    await Profile.deleteMany({ userId: { $in: syntheticUserIds } });
    await User.deleteMany({ _id: { $in: syntheticUserIds } });

    const passwordHash = await hashPassword("SyntheticPassword123!");

    console.log(`Generating ${SYNTHETIC_USER_COUNT} synthetic users (seed ${seedValue})...`);

    const users = [];
    const profiles = [];
    const contexts = [];

    for (let i = 0; i < SYNTHETIC_USER_COUNT; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        const userId = new mongoose.Types.ObjectId();

        users.push({
            _id: userId,
            email:
                `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}` +
                SYNTHETIC_EMAIL_DOMAIN,
            passwordHash,
            role: "user"
        });

        const profileSkills = randomItems(skills, 3, 6);
        const profileInterests = randomItems(interests, 2, 4);

        profiles.push({
            userId,
            name: `${firstName} ${lastName}`,
            bio: faker.person.bio(),
            education: faker.helpers.arrayElement(["MCA", "B.Tech", "BCA", "MBA", "M.Sc"]),
            role: faker.helpers.arrayElement([
                "Student",
                "Developer",
                "Designer",
                "Researcher",
                "Analyst"
            ]),
            experienceLevel: faker.helpers.arrayElement([
                "Beginner",
                "Intermediate",
                "Advanced"
            ]),
            skills: profileSkills,
            interests: profileInterests,
            matchTerms: toMatchTerms([...profileSkills, ...profileInterests]),
            collaborationPreferences: randomItems(
                ["Project-based", "Study", "Research", "Mentoring"],
                1,
                2
            ),
            visibility: "public"
        });

        const contextNeed = randomItems(skills, 1, 3);

        contexts.push({
            userId,
            goal: faker.helpers.arrayElement(goals),
            need: contextNeed,
            needTerms: toMatchTerms(contextNeed),
            activity: faker.helpers.arrayElement(activities),
            availability: faker.helpers.arrayElement(availabilityOptions),
            situation: faker.helpers.arrayElement(situations),
            interactionPreference: faker.helpers.arrayElement(interactionPreferences),
            isActive: true
        });
    }

    // Bulk inserts: three round-trips instead of three per user.
    await User.insertMany(users);
    await Profile.insertMany(profiles);
    await Context.insertMany(contexts);

    const backfilled = await backfillMatchTerms();

    console.log(`Created ${SYNTHETIC_USER_COUNT} synthetic users, profiles and contexts.`);
    console.log(
        `Retrieval terms up to date for ${backfilled.profiles} profiles and ${backfilled.contexts} contexts.`
    );

    await mongoose.disconnect();
};

seed().catch(async (error) => {
    console.error("Seed failed:", error);
    await mongoose.disconnect();
    process.exit(1);
});