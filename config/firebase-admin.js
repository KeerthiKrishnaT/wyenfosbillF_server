import 'dotenv/config';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  join(__dirname, '../config/serviceAccountKey.json');

// Set the GOOGLE_APPLICATION_CREDENTIALS environment variable
process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (e) {
  console.error('Failed to read Firebase service account:', e);
  throw e;
}

// Use environment variable for bucket, fallback to project_id.firebasestorage.app
const resolvedBucket = process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`;



if (!admin.apps.length) {
  // Use the service account file directly for better compatibility
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: resolvedBucket
  });

}

export const adminAuth = admin.auth();
export const adminFirestore = admin.firestore();
export const adminStorage = admin.storage();
// export const adminDatabase = admin.database(); // Removed, not needed