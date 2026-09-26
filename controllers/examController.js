import { db } from "../config/firebase.js";

/* 🚀 START EXAM CONTROLLER (Checks Limits & System Lock Status Before Starting) */
export const startExam = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Missing email field" });
        }

        // 🌟 FIX: Query the 'users' collection instead of 'results' because that's where your Cron script saves status flags!
        const userQuery = await db.collection("users").where("email", "==", email).limit(1).get();

        if (userQuery.empty) {
            return res.status(404).json({ message: "Student account profile not found." });
        }

        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();
        
        const hasTakenQuiz = userData.hasTakenQuiz ?? false;
        const canTakeChallenge = userData.canTakeChallenge ?? false;

        // 🛑 CRITICAL CHECK A: If the weekly master Cron has locked the platform, deny access immediately
        if (canTakeChallenge === false || hasTakenQuiz === true) {
            return res.status(403).json({   
                success: false, 
                message: "Access denied. The portal is currently locked for this session or your exam window has closed." 
            });
        }

        // 🌟 EXTRA SAFETY: If you still tracking an explicit attempt number inside the user profile, you can check it here
        const currentAttempts = userData.submissionAttempts || 0;
        if (currentAttempts >= 2) {
            // Update their flags in the users table so they get caught by your background loaders next time
            await userDoc.ref.update({
                canTakeChallenge: false,
                hasTakenQuiz: true
            });

            return res.status(403).json({   
                success: false, 
                message: "Access denied. You have reached your maximum allocation limit of 2 submissions." 
            });
        }

        // Allow them to proceed if the system is open and they haven't maxed out actions
        res.json({ 
            success: true, 
            message: "Exam authorization granted. Good luck!" 
        });

    } catch (err) {
        console.error("Error authorizing exam window:", err);
        res.status(500).json({ message: "Server error starting exam" });
    }
};


/* 🔍 CHECK USER EXAM ATTEMPTS & SYSTEM LOCK STATUS (MASTER BLOCK) */
export const checkUserAttemptsStatus = async (req, res) => {
    try {
        const { email } = req.body || req.query; // Accept email from either body or query parameters

        console.log("Checking user attempts status for email:", email);

        if (!email) {
            return res.status(400).json({ message: "Missing email field" });
        }

        // Query the permanent student profile inside the 'users' collection
        const userQuery = await db.collection("users").where("email", "==", email).limit(1).get();

        if (userQuery.empty) {
            return res.status(404).json({ message: "Student account profile not found." });
        }

        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();

        // Extract all three strategic state booleans from user data
        const hasTakenQuiz = userData.hasTakenQuiz ?? false;
        const canTakeChallenge = userData.canTakeChallenge ?? false;
        const currentAttempts = userData.submissionAttempts || 0;


        console.log(`User status for ${email}: hasTakenQuiz=${hasTakenQuiz}, canTakeChallenge=${canTakeChallenge}, submissionAttempts=${currentAttempts}`);

        // 🌟 MASTER GATEKEEPER: Checks personal attempts AND the global timeline lock flag
        if (currentAttempts >= 2 || hasTakenQuiz === true || canTakeChallenge === false) {
            console.log(`Access denied for ${email}: attempts=${currentAttempts}, hasTakenQuiz=${hasTakenQuiz}, canTakeChallenge=${canTakeChallenge}`);
            return res.json({
                success: false,
                isLockedOut: true,
                attemptsUsed: currentAttempts,
                message: "Access denied. You have used up your attempts or the exam session is locked."
            });
        }

        console.log(`Access granted for ${email}: attempts=${currentAttempts}, hasTakenQuiz=${hasTakenQuiz}, canTakeChallenge=${canTakeChallenge}`);
        // User profile is clear and the system window is fully open
        res.json({
            success: true,
            isLockedOut: false,
            attemptsUsed: currentAttempts,
            message: `User has active access. Tries used: ${currentAttempts}/2.`
        });

    } catch (err) {
        console.error("Error checking user attempts status:", err);
        res.status(500).json({ message: "Server error checking user status" });
    }
};

/* 📊 FETCH CONDENSED EXAM RESULT AND ATTEMPT METRICS */
export const getUserCondensedResult = async (req, res) => {
    try {
        const { email } = req.body || req.query; // Accept email from either body or query parameters

        if (!email) {
            return res.status(400).json({ message: "Missing email field" });
        }

        // 1. Fetch score and time from the active 'results' collection
        const resultQuery = await db.collection("results")
            .where("email", "==", email)
            .limit(1)
            .get();

        // 2. Fetch the permanent attempts counter track from the 'users' collection
        const userQuery = await db.collection("users")
            .where("email", "==", email)
            .limit(1)
            .get();

        const examScore = !resultQuery.empty ? resultQuery.docs[0].data().score : 0;
        const totalTimeSeconds = !resultQuery.empty ? resultQuery.docs[0].data().timeUsed : 0;
        const testAttemptsCount = !userQuery.empty ? (userQuery.docs[0].data().submissionAttempts || 0) : 0;

        // ⏱️ Convert timeUsed seconds into a clean MM:SS string structure
        const mins = Math.floor(totalTimeSeconds / 60);
        const secs = totalTimeSeconds % 60;
        const formattedTime = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

        // Return just the requested key summary data components
        res.json({
            success: true,
            score: examScore,                         // e.g., 2
            timeUsed: formattedTime,                  // e.g., "1:01"
            numberOfTestsTaken: testAttemptsCount     // e.g., 1 or 2
        });

    } catch (err) {
        console.error("Error harvesting compressed profile data:", err);
        res.status(500).json({ message: "Server error gathering score summary metrics" });
    }
};



/* ✅ SAVE RESULT & MANAGE ATTEMPTS BY EMAIL (CRASH & CROO-WIPE PROOF) */
export const submitExam = async (req, res) => {
    try {
        const { name, email, score, total, timeUsed } = req.body;

        console.log(name, email, score, total, timeUsed);

        if (!name || !email || total === undefined || score === undefined || timeUsed === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const percent = Math.round((score / total) * 100);

        // 1. Locate the permanent profile document inside the 'users' collection
        const userQuery = await db.collection("users").where("email", "==", email).limit(1).get();

        if (userQuery.empty) {
            return res.status(404).json({ message: "User account profile not found." });
        }

        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();
        
        // Track attempts and status metrics directly on their permanent profile
        const previousAttemptsCount = userData.submissionAttempts || 0;
        const currentAttempts = previousAttemptsCount + 1;

        // 🛑 Hard stop if they managed to execute a request after already exhausting their 2 slots
        if (previousAttemptsCount >= 2) {
            return res.status(403).json({ 
                success: false, 
                message: "Access denied. You have already submitted this exam twice." 
            });
        }

        // 2. SAVE SCORES: Create or update their submission in the 'results' collection
        // Note: Since 'results' gets cleared by your weekly script, we can query safely here for this active round.
        const resultsQuery = await db.collection("results").where("email", "==", email).limit(1).get();
        let resultDocId;

        if (!resultsQuery.empty) {
            const existingResultDoc = resultsQuery.docs[0];
            resultDocId = existingResultDoc.id;

            // Overwrite existing active round entry for Attempt #2
            await db.collection("results").doc(resultDocId).update({
                name,
                score,
                total,
                percent,
                timeUsed, 
                updatedAt: new Date(),
            });
        } else {
            // First time entry for this round
            const newResultRef = await db.collection("results").add({
                name,
                email,
                score,
                total,
                percent,
                timeUsed,
                createdAt: new Date(),
            });
            resultDocId = newResultRef.id;
        }

        // 3. PERSIST CONTROL STATE: Update tracking counts directly inside their 'users' document
        if (currentAttempts >= 2) {
            // If they just completed attempt #2, lock them out completely
            await userDoc.ref.update({
                submissionAttempts: currentAttempts,
                hasTakenQuiz: true,        // Prevents starting exams again
                canTakeChallenge: false,   // Denies entry completely
                updatedAt: new Date()
            });
        } else {
            // If it's only attempt #1, save the attempt count but keep access open for attempt #2
            await userDoc.ref.update({
                submissionAttempts: currentAttempts,
                hasTakenQuiz: false,       // Stays false so they can load attempt #2
                canTakeChallenge: true,    // Stays true so they can stay in the module
                updatedAt: new Date()
            });
        }

        res.json({ success: true, id: resultDocId });
    } catch (err) {
        console.error("Error submitting exam:", err);
        res.status(500).json({ message: "Server error processing submission" }); 
    }
};



/* ✅ GET LEADERBOARD */
export const getScores = async (req, res) => {
    try {
        const snapshot = await db
            .collection("results")
            .orderBy("percent", "desc")
            .orderBy("timeUsed", "asc")
            .limit(50)
            .get();

        const data = snapshot.docs.map((doc, i) => ({
            id: doc.id,
            rank: i + 1,
            ...doc.data(),
        }));

        res.json(data);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Error fetching leaderboard" });
    }
};