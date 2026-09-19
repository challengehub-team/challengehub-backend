import { db } from "../config/firebase.js";

/* 🚀 START EXAM CONTROLLER (Checks Limits Before Starting) */
export const startExam = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Missing email field" });
        }

        // Check if this student already has records in the database
        const userQuery = await db.collection("results").where("email", "==", email).limit(1).get();

        if (!userQuery.empty) {
            const existingData = userQuery.docs[0].data();
            const currentAttempts = existingData.submissionAttempts || 0;

            // If they have already completed 2 submissions, block them from starting a 3rd time
            if (currentAttempts >= 2) {
                return res.status(403).json({ 
                    success: false, 
                    message: "Access denied. You have already submitted this exam twice." 
                });
            }
        }

        // Allow them to proceed if they have 0 or 1 previous submissions
        res.json({ 
            success: true, 
            message: "Exam authorization granted. Good luck!" 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error starting exam" });
    }
};



/* ✅ SAVE RESULT & MANAGE ATTEMPTS BY EMAIL */
export const submitExam = async (req, res) => {
    try {
        const { name, email, score, total, timeUsed } = req.body;

        console.log(name, email, score, total, timeUsed);

        if (!name || !email || total === undefined || score === undefined || timeUsed === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const percent = Math.round((score / total) * 100);

        // Find if this student already has a record in the database
        const userQuery = await db.collection("results").where("email", "==", email).limit(1).get();

        let docId;

        if (!userQuery.empty) {
            // 🌟 FIX: Added [0] here so it targets the actual existing document object!
            const existingDoc = userQuery.docs[0]; 
            const existingData = existingDoc.data();
            docId = existingDoc.id;

            const previousAttemptsCount = existingData.submissionAttempts || 1;

            if (previousAttemptsCount >= 2) {
                return res.status(403).json({ 
                    success: false, 
                    message: "Access denied. You have already submitted this exam twice." 
                });
            }

            // ALWAYS OVERWRITE: Overwrites the record on this 2nd attempt, whether score is high or low
            await db.collection("results").doc(docId).update({
                name,
                score,
                total,
                percent,
                timeUsed, 
                submissionAttempts: 2, // Marks that they used their second and final attempt
                updatedAt: new Date(),
            });

        } else {
            // User doesn't exist, create a brand new record (Attempt #1)
            const docRef = await db.collection("results").add({
                name,
                email,
                score,
                total,
                percent,
                timeUsed,
                submissionAttempts: 1, // First try tracking flag
                createdAt: new Date(),
            });
            docId = docRef.id;
        }

        res.json({ success: true, id: docId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" }); 
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