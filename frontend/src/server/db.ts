import "server-only";
import mongoose from "mongoose";

// Next.js reloads modules during development and may reuse a warm server
// between requests, so the connection is cached on globalThis instead of
// opening a new one per request.
const globalForMongoose = globalThis as typeof globalThis & {
    mongooseConnection?: Promise<typeof mongoose>;
};

export const connectDatabase = async (): Promise<typeof mongoose> => {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is not defined.");
    }

    if (!globalForMongoose.mongooseConnection) {
        globalForMongoose.mongooseConnection = mongoose
            .connect(mongoUri)
            .catch((error) => {
                // Allow the next request to retry instead of caching the failure.
                globalForMongoose.mongooseConnection = undefined;
                throw error;
            });
    }

    return globalForMongoose.mongooseConnection;
};