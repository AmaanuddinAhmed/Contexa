import dotenv from "dotenv";
import { faker } from "@faker-js/faker";
import { connectDatabase } from "./config/database.js";
import { User } from "./models/User.js";
import { Profile } from "./models/Profile.js";
import { Context } from "./models/Context.js";
import { hashPassword } from "./utils/password.js";

dotenv.config();

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

    return faker.helpers
        .shuffle(items)
        .slice(0, count);
};

const seed = async (): Promise<void> => {
    await connectDatabase();

    console.log("Clearing existing synthetic data...");

    await Context.deleteMany({});
    await Profile.deleteMany({});
    await User.deleteMany({
        email: { $regex: /@synthetic\.contexa\.local$/ }
    });

    const passwordHash = await hashPassword("SyntheticPassword123!");

    console.log("Generating synthetic users...");

    for (let i = 0; i < 100; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        const email =
            `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}` +
            "@synthetic.contexa.local";

        const user = await User.create({
            email,
            passwordHash,
            role: "user"
        });

        await Profile.create({
            userId: user._id,
            name: `${firstName} ${lastName}`,
            bio: faker.person.bio(),
            education: faker.helpers.arrayElement([
                "MCA",
                "B.Tech",
                "BCA",
                "MBA",
                "M.Sc"
            ]),
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
            skills: randomItems(skills, 3, 6),
            interests: randomItems(interests, 2, 4),
            collaborationPreferences: randomItems(
                ["Project-based", "Study", "Research", "Mentoring"],
                1,
                2
            ),
            visibility: "public"
        });

        await Context.create({
            userId: user._id,
            goal: faker.helpers.arrayElement(goals),
            need: randomItems(skills, 1, 3),
            activity: faker.helpers.arrayElement(activities),
            availability: faker.helpers.arrayElement(
                availabilityOptions
            ),
            situation: faker.helpers.arrayElement(situations),
            interactionPreference: faker.helpers.arrayElement(
                interactionPreferences
            ),
            isActive: true
        });
    }

    console.log("Synthetic data generation complete.");
    console.log("Created 100 users, profiles and contexts.");

    process.exit(0);
};

seed().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
});