import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { connectDatabase } from "./config/database.js";

import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import contextRoutes from "./routes/contextRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/context", contextRoutes);

app.get("/api/v1/health", (_req, res) => {
    res.json({
        success: true,
        message: "CONTEXA backend is running."
    });
});


const startServer = async (): Promise<void> => {
    await connectDatabase();

    app.listen(PORT, () => {
        console.log(`CONTEXA backend running on http://localhost:${PORT}`);
    });
};

startServer();