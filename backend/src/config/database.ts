import mongoose from "mongoose";

export const connectDatabase = async (): Promise<void> => {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is not defined.");
    }

    try {
        await mongoose.connect(mongoUri);
        console.log("CONTEXA database connected.");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
};