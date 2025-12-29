# MichoScribe Migration Guide - New Google Cloud Account

---

## Part 1: Logout from Current GCloud Account

```bash
# List current accounts
gcloud auth list

# Revoke all credentials
gcloud auth revoke --all

# Clear application default credentials
gcloud auth application-default revoke
```

---

## Part 2: Login to New GCloud Account

```bash
# Login with browser
gcloud auth login

# Set application default credentials (used by APIs)
gcloud auth application-default login

# Verify login
gcloud auth list
```

---

## Part 3: Create New GCloud Project

```bash
# Create a new project
gcloud projects create YOUR-NEW-PROJECT-ID --name="MichoScribe"

# Set as default project
gcloud config set project YOUR-NEW-PROJECT-ID
```

### Enable Billing

1. Go to: https://console.cloud.google.com/billing
2. Link the new project to a billing account

### Enable Required APIs (Console UI)

1. **Speech-to-Text API**: https://console.cloud.google.com/apis/library/speech.googleapis.com
2. **Vertex AI API**: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com
3. **Cloud Resource Manager API**: https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com

Or via CLI:
```bash
gcloud services enable speech.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
```

---

## Part 4: Create Firebase Project

1. Go to: https://console.firebase.google.com/
2. Click "Add project"
3. **IMPORTANT**: Select your existing GCloud project (YOUR-NEW-PROJECT-ID)
4. Enable Google Analytics (optional)
5. Continue to create

### Enable Firebase Services

In Firebase Console:
1. **Authentication** → Get started → Enable Anonymous sign-in
2. **Realtime Database** → Create database → Start in test mode
3. **Firestore** → Create database → Start in test mode
4. **Storage** → Get started → Start in test mode

### Get Firebase Web Config

1. Go to Project Settings → General
2. Scroll to "Your apps" → Click web icon (`</>`)
3. Register app name: "MichoScribe Web"
4. Copy the config object (firebaseConfig)

### Generate Service Account Key

1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Move to backend folder:

```bash
mv ~/Downloads/YOUR-PROJECT-firebase-adminsdk-*.json \
   /path/to/bun-server-michoscribe/
```

---

## Part 5: Firebase Realtime Database Rules

1. Go to: Realtime Database → Rules
2. Replace with:

```json
{
  "rules": {
    "transcriptions": {
      "$userId": {
        ".read": "auth != null && auth.uid === $userId",
        ".write": "auth != null && auth.uid === $userId"
      }
    }
  }
}
```

3. Click **"Publish"**

---

## Part 6: Firestore Rules

1. Go to: Firestore Database → Rules
2. Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /embeddings/{docId} {
      allow read, write: if false;
    }
  }
}
```

3. Click **"Publish"**

---

## Part 7: Firebase Storage Rules

1. Go to: Storage → Rules
2. Replace with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile pictures - users can read/write their own
    match /profile-pictures/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click **"Publish"**

> These rules allow any authenticated user to view profile pictures, but only the owner can upload/modify their own.

---

## Part 8: Firestore Vector Indexes (CLI Required)

Run these commands to create the vector indexes for RAG search:

```bash
# Index 1: embeddings (userId, jobId, __name__, embedding)
gcloud firestore indexes composite create \
  --collection-group=embeddings \
  --field-config=field-path=userId,order=ASCENDING \
  --field-config=field-path=jobId,order=ASCENDING \
  --field-config=field-path=__name__,order=ASCENDING \
  --field-config=field-path=embedding,vector-config='{"dimension":"768","flat":"{}"}' \
  --project=YOUR-NEW-PROJECT-ID

# Index 2: embeddings (userId, __name__, embedding)
gcloud firestore indexes composite create \
  --collection-group=embeddings \
  --field-config=field-path=userId,order=ASCENDING \
  --field-config=field-path=__name__,order=ASCENDING \
  --field-config=field-path=embedding,vector-config='{"dimension":"768","flat":"{}"}' \
  --project=YOUR-NEW-PROJECT-ID
```

Check index status at: https://console.firebase.google.com/project/YOUR-PROJECT/firestore/indexes

> Indexes take 5-10 minutes to build. Wait for status "Enabled".

---

## Part 9: Create Gemini API Key

1. Go to: https://aistudio.google.com/apikey
2. Select your new project
3. Click "Create API Key"
4. Copy the key

---

## Part 10: Grant Service Account Permissions

### Via Console UI (Recommended)

1. Go to: https://console.cloud.google.com/iam-admin/iam
2. Find the Firebase service account: `firebase-adminsdk-xxxxx@YOUR-PROJECT.iam.gserviceaccount.com`
3. Click Edit (pencil icon)
4. Add role: **Cloud Speech Client**
5. Save

### Or via CLI

```bash
gcloud projects add-iam-policy-binding YOUR-NEW-PROJECT-ID \
  --member="serviceAccount:firebase-adminsdk-xxxxx@YOUR-PROJECT.iam.gserviceaccount.com" \
  --role="roles/speech.client"
```

---

## Part 11: Update Application Config Files

### Backend `.env` (bun-server-michoscribe/.env)

```env
# Gemini API
GEMINI_API_KEY=YOUR_NEW_GEMINI_API_KEY

# Google Cloud Project ID
GCP_PROJECT_ID=YOUR-NEW-PROJECT-ID

# Kafka (unchanged)
KAFKA_BROKER=localhost:9092

# Firebase
FIREBASE_DATABASE_URL=https://YOUR-NEW-PROJECT-ID-default-rtdb.firebaseio.com
FIREBASE_SERVICE_ACCOUNT=./YOUR-NEW-PROJECT-firebase-adminsdk-xxxxx.json
```

### Frontend `.env` (michoscribe-react-router/.env)

```env
VITE_FIREBASE_API_KEY=YOUR_NEW_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR-NEW-PROJECT-ID.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://YOUR-NEW-PROJECT-ID-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=YOUR-NEW-PROJECT-ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR-NEW-PROJECT-ID.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_NEW_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_NEW_APP_ID
VITE_FIREBASE_MEASUREMENT_ID=YOUR_NEW_MEASUREMENT_ID
```

---

## Part 12: Test the Migration

```bash
# Test GCloud CLI
gcloud auth list
gcloud config get-value project

# Start backend
cd bun-server-michoscribe
bun run dev

# Start frontend (in another terminal)
cd michoscribe-react-router
bun run dev
```

---

## Quick Reference: Files to Update

| File | What to Change |
|------|----------------|
| `bun-server-michoscribe/.env` | GEMINI_API_KEY, GCP_PROJECT_ID, FIREBASE_* |
| `bun-server-michoscribe/*.json` | Replace Firebase service account file |
| `michoscribe-react-router/.env` | All VITE_FIREBASE_* values |

---

## Checklist

- [ ] Logout from old GCloud account
- [ ] Login to new GCloud account
- [ ] Create new GCloud project
- [ ] Enable billing
- [ ] Enable APIs (Speech-to-Text, Vertex AI, Cloud Resource Manager)
- [ ] Create Firebase project (linked to GCloud project)
- [ ] Enable Authentication (Anonymous)
- [ ] Create Realtime Database + set rules
- [ ] Create Firestore + set rules
- [ ] Create Storage + set rules
- [ ] Create Firestore vector indexes (CLI)
- [ ] Generate Firebase service account key
- [ ] Create Gemini API key
- [ ] Grant Speech Client role to service account
- [ ] Update backend .env
- [ ] Update frontend .env
- [ ] Test application
