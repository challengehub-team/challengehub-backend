import { admin, db } from "../config/firebase.js";

// Global tracker: sets if the competition is currently locked or open
let isCompetitionLocked = true;

/**
 * 1. THE 1-MINUTE BACKGROUND SCANNER
 * Runs every 60 seconds. When the competition reopens, it finds any new users
 * who just joined and immediately grants them full access to start the exam.
 */
async function scanAndSyncNewUsers() {
  try {
    const usersRef = db.collection("users");
    
    // Look for new accounts that still have the default uninitialized flags
    const snapshot = await usersRef
      .where("hasTakenQuiz", "==", false)
      .where("canTakeChallenge", "==", false)
      .get();

    if (snapshot.empty) return;

    const bulkWriter = db.bulkWriter();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      if (isCompetitionLocked) {
        // If system is currently locked: make sure new users are safely locked out
        bulkWriter.update(doc.ref, {
          hasTakenQuiz: true,
          canTakeChallenge: false,
        });
      } else {
        // If system has reopened: IMMEDIATELY update flags to allow them to join the exam!
        bulkWriter.update(doc.ref, {
          hasTakenQuiz: false,       // Allows user to start the exam
          canTakeChallenge: true,    // Allows user to enter the competition area
        });
      }
      count++;
    });

    // Commit updates to the database
    await bulkWriter.close();
    if (count > 0 && !isCompetitionLocked) {
      console.log(`[${new Date().toLocaleTimeString()}] 🟢 Scanner: Automatically activated ${count} new user(s) into the live exam!`);
    }
  } catch (error) {
    console.error("❌ Background Scanner Error:", error);
  }
}

/**
 * 2. DATABASE USER RESET/LOCK UTILITY
 * Bulk updates existing accounts when shifting between locked and opened phases.
 */
async function updateExistingUsersState(targetHasTakenQuiz, targetCanTakeChallenge, label) {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] 🔄 Shifting database to: ${label}...`);
    const usersRef = db.collection("users");
    const snapshot = await usersRef.get();

    if (snapshot.empty) return;

    const bulkWriter = db.bulkWriter();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      const userData = doc.data();
      // Update only if their parameters do not match the target state
      if (
        userData.hasTakenQuiz !== targetHasTakenQuiz ||
        userData.canTakeChallenge !== targetCanTakeChallenge
      ) {
        bulkWriter.update(doc.ref, {
          hasTakenQuiz: targetHasTakenQuiz,
          canTakeChallenge: targetCanTakeChallenge,
        });
        count++;
      }
    });

    await bulkWriter.close();
    console.log(`Successfully updated ${count} user documents.`);
  } catch (error) {
    console.error(`❌ Error updating states for ${label}:`, error);
  }
}

/**
 * 3. RESULTS COLLECTION CLEANUP
 * Completely deletes all entries/documents inside the "results" collection
 * right after a competition round finishes.
 */
async function clearAllResultsData() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] 🗑️ Cleaning up: Wiping out old exam results data...`);
    const resultsRef = db.collection("results");
    const snapshot = await resultsRef.get();

    if (snapshot.empty) {
      console.log("No result documents found to delete.");
      return;
    }

    const bulkWriter = db.bulkWriter();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      bulkWriter.delete(doc.ref); // Delete the results entry document entirely
      count++;
    });

    await bulkWriter.close();
    console.log(`Successfully deleted ${count} entries from the results collection.`);
  } catch (error) {
    console.error("❌ Error clearing results data collection:", error);
  }
}

/**
 * 4. THE MAIN TIMELINE CONTROLLER (WEEKLY SCHEDULE)
 * Manages the alternating 3-day open windows and 4-day lockdowns.
 */
async function runCompetitionCycle() {
  // CRASH PROTECTION CHECK: See if we just recovered from a crash
  try {
    const backupRef = db.collection("system").doc("liveCycleBackup");
    const doc = await backupRef.get();
    
    if (doc.exists && doc.data().isCompetitionLocked === false) {
      console.log("⚠️ System recovery detected! Resuming open phase directly...");
      isCompetitionLocked = false;
      
      // Keep open for the 5-day live and leaderboard viewing window
      console.log("🔓 Competition resumed! Keeping open for the 5-day window...");
      await new Promise((resolve) => setTimeout(resolve, 4 * 24 * 60 * 60 * 1000)); // 4 Days Open
    }
  } catch (err) {
    console.error("Crash recovery check failed, starting fresh loop:", err);
  }

  while (true) {
    // ====================================================
    // PHASE 2 (RUNS FIRST): OPEN FOR EXAM & LEADERBOARD
    // ====================================================
    isCompetitionLocked = false;
    
    // Save open state to Firestore backup to protect against unexpected server drops
    await db.collection("system").doc("liveCycleBackup").set({ isCompetitionLocked: false });

    // Open competition parameters (cantakechallenge=true allows entry, hastakenquiz=false allows exam start)
    await updateExistingUsersState(false, true, "COMPETITION OPENED (Testing & Leaderboard Active)");

    console.log("🔓 Competition is wide open! Running live phase for 5 days...");
    await new Promise((resolve) => setTimeout(resolve, 4 * 24 * 60 * 60 * 1000)); // 4 Days Open (Testing + Viewing)


    // ====================================================
    // PHASE 1: START THE 4-DAY LOCKDOWN (MONDAY MORNING)
    // ====================================================
    isCompetitionLocked = true;
    
    // Save lock state to Firestore backup so Render doesn't wipe data again if it restarts
    await db.collection("system").doc("liveCycleBackup").set({ isCompetitionLocked: true });

    // Force a complete lockout (canTakeChallenge: false) to stop all entries
    await updateExistingUsersState(true, false, "ABSOLUTE LOCKDOWN PHASE");
    
    // Wipe out the exam results data collection completely now that the 3 days are up
    await clearAllResultsData();
    
    console.log("⏳ Lockdown active and results data deleted. Holding status for 3 days...");
    await new Promise((resolve) => setTimeout(resolve, 3 * 24 * 60 * 60 * 1000)); // 3 Days Locked (Monday to Thursday)
  }
}


// =================================================================
// SYSTEM INITIALIZATION START
// =================================================================
console.log("🚀 Master Automation System initialized and active!");

// Initialize the 1-minute background loop interval to keep checking for incoming live signups
const ONE_MINUTE_IN_MS = 60 * 1000;
setInterval(() => {
  scanAndSyncNewUsers();
}, ONE_MINUTE_IN_MS);

// Start the main infinite 10-minute automation timeline loop
runCompetitionCycle();
