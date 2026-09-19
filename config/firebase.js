import admin from "firebase-admin";
import { readFile } from "fs/promises";

let serviceAccount;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // 1. Try reading from the Environment Variable (Render)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // 2. Try reading from the local file (Local computer)
    const jsonURL = new URL("../serviceAccountKey.json", import.meta.url);
    serviceAccount = JSON.parse(await readFile(jsonURL, "utf8"));
  }
} catch (error) {
  // 3. Fallback: If both fail, let's look for a stringified env variable that might have quotes
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.trim());
  } else {
    throw new Error("Firebase credentials missing from both Environment Variables and local file system.");
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };
