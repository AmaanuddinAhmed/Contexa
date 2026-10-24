import { faker } from "@faker-js/faker";
import mongoose from "mongoose";
import { toMatchTerms } from "../../src/server/recommendations/terms";
import {
    AVAILABILITY,
    COLLEGES,
    INTERACTION,
    LOCALITIES,
    PERSONAS,
    REGIONS
} from "./sampleData";

export const SYNTHETIC_EMAIL_DOMAIN = "@synthetic.contexa.local";

const pick = <T>(items: readonly T[]): T => faker.helpers.arrayElement(items);

const pickWeighted = <T extends { weight: number }>(items: readonly T[]): T =>
    faker.helpers.weightedArrayElement(items.map((item) => ({ weight: item.weight, value: item })));

const pickSome = <T>(items: readonly T[], min: number, max: number): T[] =>
    faker.helpers.arrayElements(items, { min: Math.min(min, items.length), max: Math.min(max, items.length) });

const chance = (probability: number): boolean => faker.number.float({ min: 0, max: 1 }) < probability;

const fill = (template: string, values: Record<string, string>): string =>
    template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? "");

const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

export const buildSamples = (count: number, seedValue: number, passwordHash: string) => {
    faker.seed(seedValue);

    const users = [];
    const profiles = [];
    const contexts = [];
    const usedNames = new Set<string>();

    for (let i = 0; i < count; i++) {
        const region = pickWeighted(REGIONS);
        const group = pickWeighted(region.groups);
        const languages = group.languages ?? region.languages;

        let firstName = "";
        let surname = "";

        do {
            firstName = pick(chance(0.5) ? group.male : group.female);
            surname = pick(group.surnames);
        } while (usedNames.has(`${firstName} ${surname}`));

        const name = `${firstName} ${surname}`;
        usedNames.add(name);

        const persona = pickWeighted(PERSONAS);
        const student = chance(persona.studentShare);
        const hometown = pick(region.hometowns);
        const locality = pick(LOCALITIES);
        const years = faker.number.int({ min: 1, max: 8 });

        const degree = pick(student ? persona.education.student : persona.education.working);
        const college = pick(/^(B\.E|B\.Tech|M\.Tech)/.test(degree) ? COLLEGES.engineering : COLLEGES.general);
        const education = chance(student ? 0.8 : 0.4) ? `${degree}, ${college}` : degree;

        const skills = pickSome(persona.skills, 3, 6);
        if (chance(0.35)) {
            skills.push(languages[0]);
        }

        const bio = chance(0.85)
            ? fill(pick(student ? persona.bios.student : persona.bios.working), {
                hometown,
                locality,
                college,
                years: `${years} ${years === 1 ? "year" : "years"} in`
            })
            : undefined;

        const interests = pickSome(persona.interests, 2, 4);
        const userId = new mongoose.Types.ObjectId();

        users.push({
            _id: userId,
            email: `${slug(firstName)}.${slug(surname)}.${i}${SYNTHETIC_EMAIL_DOMAIN}`,
            passwordHash,
            role: "user"
        });

        profiles.push({
            userId,
            name,
            bio,
            education,
            role: pick(student ? persona.roles.student : persona.roles.working),
            experienceLevel: student
                ? faker.helpers.weightedArrayElement([
                    { weight: 45, value: "Beginner" },
                    { weight: 45, value: "Intermediate" },
                    { weight: 10, value: "Advanced" }
                ])
                : faker.helpers.weightedArrayElement([
                    { weight: 10, value: "Beginner" },
                    { weight: 45, value: "Intermediate" },
                    { weight: 45, value: "Advanced" }
                ]),
            skills,
            interests,
            matchTerms: toMatchTerms([...skills, ...interests]),
            collaborationPreferences: pickSome(persona.collaboration, 1, 2),
            visibility: "public",
            isSample: true
        });

        if (chance(0.92)) {
            const need = pickSome(persona.needs, 1, 3).filter((item) => !skills.includes(item));
            if (region.key !== "karnataka" && chance(0.12)) {
                need.push("Kannada");
            }
            if (need.length === 0) {
                need.push(pick(persona.needs.filter((item) => !skills.includes(item))));
            }

            contexts.push({
                userId,
                goal: pick(persona.goals),
                need,
                needTerms: toMatchTerms(need),
                activity: pick(persona.activities),
                availability: pick(AVAILABILITY),
                situation: fill(pick(persona.situations), { locality }),
                interactionPreference: faker.helpers.weightedArrayElement(
                    INTERACTION.map((option) => ({ weight: option.weight, value: option.value }))
                ),
                isActive: true
            });
        }
    }

    return { users, profiles, contexts };
};