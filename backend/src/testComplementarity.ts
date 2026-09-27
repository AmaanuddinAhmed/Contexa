import dotenv from "dotenv";
import { connectDatabase } from "./config/database.js";
import { IProfile } from "./models/Profile.js";
import { IContext } from "./models/Context.js";
import {
    calculateContextCompatibility
} from "./services/contextMatchingService.js";

dotenv.config();

const testComplementarity = async (): Promise<void> => {
    await connectDatabase();

    const profileA = {
        skills: ["Python"],
        interests: [],
        experienceLevel: "Intermediate",
        collaborationPreferences: ["Project-based"]
    } as unknown as IProfile;

    const profileB = {
        skills: ["React"],
        interests: [],
        experienceLevel: "Intermediate",
        collaborationPreferences: ["Project-based"]
    } as unknown as IProfile;

    const contextA = {
        need: ["React"],
        activity: "Building a software project",
        availability: "Weekends",
        interactionPreference: "Online"
    } as unknown as IContext;

    const contextB = {
        need: ["Python"],
        activity: "Building a software project",
        availability: "Weekends",
        interactionPreference: "Online"
    } as unknown as IContext;

    const result = calculateContextCompatibility(
        profileA,
        profileB,
        contextA,
        contextB
    );

    console.log("\nControlled complementarity test:");
    console.log(result);

    if (
        result.breakdown.needFulfillmentA !== 1 ||
        result.breakdown.needFulfillmentB !== 1
    ) {
        throw new Error(
            "Complementarity test failed."
        );
    }

    console.log(
        "\nComplementarity test passed successfully."
    );

    process.exit(0);
};

testComplementarity().catch((error) => {
    console.error(
        "Complementarity test failed:",
        error
    );

    process.exit(1);
});