import admin from "firebase-admin";
import { readFile } from "fs/promises";

let serviceAccount;

// 1. Check if the environment variable exists first (Render)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.trim());
  } catch (parseError) {
    console.error("ERROR: Found FIREBASE_SERVICE_ACCOUNT but it is not valid JSON!");
    throw parseError;
  }
} else {
  // 2. Fallback to local file system (Local Computer)
  try {
    const jsonURL = new URL("../serviceAccountKey.json", import.meta.url);
    serviceAccount = JSON.parse(await readFile(jsonURL, "utf8"));
  } catch (fileError) {
    console.log("Current Environment Keys:", Object.keys(process.env));
    throw new Error(
      "Firebase configuration missing! Make sure FIREBASE_SERVICE_ACCOUNT is set in your Render environment variables."
    );
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };
