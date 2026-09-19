// routes/paymentRoutes.js
import express from "express";
import { getScores, submitExam, startExam } from "../controllers/examController.js";

const router = express.Router();

router.post("/submit", submitExam);
router.get("/leaderboard", getScores);
router.post("/start", startExam); 


export default router;