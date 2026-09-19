import express from "express";
import {
  initializePayment,
  verifyPayment,
} from "../controllers/paymentController.js"; // Note the mandatory .js extension

const router = express.Router();

router.post("/initialize", initializePayment);
router.post("/verify", verifyPayment);

export default router;
