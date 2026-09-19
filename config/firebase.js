import admin from "firebase-admin";
import { readFile } from "fs/promises";

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // On Render: Read from Environment Variables
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Locally: Read the local JSON file safely in ES modules
  const jsonURL = new URL("./serviceAccount.json", import.meta.url);
  serviceAccount = JSON.parse(await readFile(jsonURL, "utf8"));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };
