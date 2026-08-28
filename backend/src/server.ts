import express from "express";
import cors from "cors";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.json({
    success: true,
    message: "CONTEXA backend is running.",
  });
});

app.listen(PORT, () => {
  console.log(`CONTEXA backend running on http://localhost:${PORT}`);
});
