import { admin, db } from "../config/firebase.js";

// 🌟 CRITICAL SYNC FIELDS: Kept global so every single user requests the exact same data feed value
let globalSharedOnlineCount = 25; // Seed starting traffic value
let actualRealOnlineCount = 0;

/**
 * ⏱️ THE AUTOMATED INDEPENDENT FLUCTUATION TICKER
 * Runs in the background on your server every 10 seconds.
 * It builds an absolute synchronized matrix that goes up to 30, 40, 50, handles drops, and stops at 60.
 */
const startBackgroundTrafficSync = () => {
  setInterval(async () => {
    try {
      // 1. Fetch real online users from Firestore to use as the true baseline anchor
      const usersRef = db.collection("users");
      const snapshot = await usersRef.where("isOnline", "==", true).get();

      console.log(`[${new Date().toLocaleTimeString()}] 🔄 Background sync: Found ${snapshot.size} real online users in Firestore.`);
      actualRealOnlineCount = snapshot.size;
    } catch (err) {
      console.error("Firestore background real-count sync error:", err);
    }

    // 2. Manage the organic wave behavior between 20 and 60
    const changeDirection = Math.random() > 0.45; // Slightly biased to stay up

    if (changeDirection) {
      // Fluctuation growth steps: +1, +2, +3, or +5
      const growthSteps = [1, 2, 3, 5];
      const addedValue = growthSteps[Math.floor(Math.random() * growthSteps.length)];
      globalSharedOnlineCount += addedValue;
    } else {
      // Fluctuation reduction steps: -1, -2, or -4
      const dropSteps = [1, 2, 4];
      const subtractedValue = dropSteps[Math.floor(Math.random() * dropSteps.length)];
      globalSharedOnlineCount -= subtractedValue;
    }

    // 🛑 HARD STRUCTURAL FLOORS AND CEILINGS
    if (globalSharedOnlineCount < 20) {
      globalSharedOnlineCount = 22; // Hard floor to keep activity looking busy
    }
    
    if (globalSharedOnlineCount > 60) {
      globalSharedOnlineCount = 56; // 🛑 ABSOLUTE CEILING: Hard stop at 60, bounces back down cleanly
    }

    // Mix the real database counts with our global shared wave modifier
    globalSharedOnlineCount = Math.max(globalSharedOnlineCount, actualRealOnlineCount + 15);

  }, 10000); // Ticks and updates every 10 seconds globally
};

// Start the ticker immediately when your server boots up
startBackgroundTrafficSync();

/**
 * 📊 THE PUBLIC ENDPOINT API CONTROLLER
 * Every user who pings this endpoint gets the exact same snapshot value from the global feed!
 */
export const getDynamicOnlineStudentsCount = async (req, res) => {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] 📡 Dispatching synchronized live counter: ${globalSharedOnlineCount} online students.`);
    res.json({
      success: true,
      onlineCount: globalSharedOnlineCount // Everyone reads the same shared memory stream
    });
  } catch (error) {
    console.error("Error dispatching synchronized live counter:", error);
    res.status(500).json({ message: "Server error tracking live traffic" });
  }
};
