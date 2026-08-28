import dotenv from "dotenv";
import { connectDatabase } from "./config/database.js";
import { User } from "./models/User.js";

dotenv.config();

const testDatabase = async (): Promise<void> => {
    await connectDatabase();

    const testEmail = "database-test@contexa.local";

    await User.deleteOne({ email: testEmail });

    const user = await User.create({
        email: testEmail,
        passwordHash: "test-hash"
    });

    console.log("Created test user:", user.email);

    const foundUser = await User.findOne({ email: testEmail });

    console.log("Found test user:", foundUser?.email);

    await User.deleteOne({ email: testEmail });

    console.log("Database test completed successfully.");

    process.exit(0);
};

testDatabase();