import dotenv from "dotenv";
import { connectDatabase } from "./config/database.js";
import { Profile } from "./models/Profile.js";
import { calculateProfileSimilarity } from "./services/profileMatchingService.js";

dotenv.config();

const testProfileBaseline = async (): Promise<void> => {
    await connectDatabase();

    const profiles = await Profile.find({
        visibility: "public"
    }).limit(10);

    if (profiles.length < 10) {
        throw new Error("Not enough profiles available.");
    }

    console.log("\nProfile baseline test\n");

    for (let i = 0; i < 5; i++) {
        const first = profiles[i];
        const second = profiles[i + 5];

        const result = calculateProfileSimilarity(first, second);

        console.log(
            `${first.name} ↔ ${second.name}: ${result.score}`
        );

        if (result.score < 0 || result.score > 1) {
            throw new Error("Invalid similarity score.");
        }
    }

    console.log("\nAll baseline scores are within [0, 1].");

    process.exit(0);
};

testProfileBaseline().catch((error) => {
    console.error("Baseline test failed:", error);
    process.exit(1);
});