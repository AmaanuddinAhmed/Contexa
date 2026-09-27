import { Router } from "express";
import {
    getRecommendationList
} from "../controllers/recommendationController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, getRecommendationList);

export default router;