import { Router } from "express";
import {
    createContext,
    deactivateContext,
    getActiveContext
} from "../controllers/contextController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, getActiveContext);
router.post("/", authenticate, createContext);
router.delete("/", authenticate, deactivateContext);

export default router;