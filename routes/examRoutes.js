// routes/paymentRoutes.js
import express from "express";
import { getScores, submitExam, startExam, checkUserAttemptsStatus, getUserCondensedResult} from "../controllers/examController.js";

const router = express.Router();

router.post("/submit", submitExam);
router.get("/leaderboard", getScores);
router.post("/start", startExam); 
router.get("/status", checkUserAttemptsStatus); 
router.get("/condensed-result", getUserCondensedResult);

export default router;