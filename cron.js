import { admin, db } from "./config/firebase.js";

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
 * 4. THE MAIN TIMELINE CONTROLLER (WITH RENDER CRASH PROTECTION)
 * Manages the alternating 10-minute timelines, locks/unlocks the system, and clears stats.
 */
async function runCompetitionCycle() {
  // CRASH PROTECTION CHECK: See if we just recovered from a crash
  try {
    const backupRef = db.collection("system").doc("liveCycleBackup");
    const doc = await backupRef.get();
    
    if (doc.exists && doc.data().isCompetitionLocked === false) {
      console.log("⚠️ System recovery detected! Render restarted while competition was open. Resuming open phase directly...");
      isCompetitionLocked = false;
      // Skip Phase 1 entirely this time and go straight to holding the open state
      console.log("🔓 Competition resumed! Running for remaining time...");
      await new Promise((resolve) => setTimeout(resolve, 10 * 60 * 1000));
    }
  } catch (err) {
    console.error("Crash recovery check failed, starting fresh loop:", err);
  }

  while (true) {
    // ====================================================
    // PHASE 1: START THE LOCKDOWN IMMEDIATELY
    // ====================================================
    isCompetitionLocked = true;
    
    // Save to Firestore backup so Render doesn't wipe data again if it crashes
    await db.collection("system").doc("liveCycleBackup").set({ isCompetitionLocked: true });

    // Force a complete lockout (canTakeChallenge: false) to stop all entries
    await updateExistingUsersState(true, false, "ABSOLUTE LOCKDOWN & RESET PHASE");
    
    // Wipe out the exam results data collection entirely now that the round is finished
    await clearAllResultsData();
    
    console.log("⏳ Lockdown active and results data deleted. Holding status for 10 minutes...");
    await new Promise((resolve) => setTimeout(resolve, 10 * 60 * 1000)); // Sleep 10 minutes

    // ====================================================
    // PHASE 2: REOPEN THE COMPETITION FOR EVERYONE
    // ====================================================
    isCompetitionLocked = false;
    
    // Save to Firestore backup before opening so we are safe from crash wipes
    await db.collection("system").doc("liveCycleBackup").set({ isCompetitionLocked: false });

    // Open competition (hasTakenQuiz: false to allow start, canTakeChallenge: true to allow entry)
    await updateExistingUsersState(false, true, "COMPETITION OPENED (Testing Resumed)");

    console.log("🔓 Competition is active! Users can log in and test. Running for 10 minutes...");
    await new Promise((resolve) => setTimeout(resolve, 10 * 60 * 1000)); // Sleep 10 minutes before looping back
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
