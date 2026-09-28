import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { db } from "../config/firebase.js";

const router = express.Router();

router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Welcome to dashboard",
      user: userDoc.data(),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log(err.message);
  }
});

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Welcome to dashboard",
      user: userDoc.data(),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Removed verifyToken entirely for public access
router.get("/profile-pic", async (req, res) => {
  try {
    // 1. Explicitly grab the email from the URL query parameters (?email=...)
    const email = req.query.email; 

    if (!email) {
      return res.status(400).json({ error: "Email parameter is required in the query string (?email=...)" });
    }

    // 2. Query your Firestore collection where the string matches
    const userSnapshot = await db.collection("users")
      .where("email", "==", email)
      .limit(1) 
      .get();

    // 3. Handle a missing user profile safely
    if (userSnapshot.empty) {
      return res.status(404).json({ error: "No user found with this email" });
    }

    // 4. Extract and return the profile data
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // SECURITY WARNING: Remove passwords or tokens before returning public records
    delete userData.password; 
    delete userData.secretToken;

    res.json({
      message: "Public profile retrieved successfully",
      user: userData,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* router.get("/profile", verifyToken, async (req, res) => {
  try {
    const uid = req.body;

    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
     userData: userDoc 
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}); */

export default router;