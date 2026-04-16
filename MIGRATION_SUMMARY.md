# JANKI Migration Summary

## ✅ Completed Tasks

### 1. **Project Setup**
- ✅ Initialized Vite + TypeScript project
- ✅ Created modular project structure (`src/lib`, `src/styles`, `src/types`)
- ✅ Configured build to output to `dist/`
- ✅ Set up environment variables with `.env` and `.env.example`

### 2. **Code Refactoring**
- ✅ Extracted CSS from inline to `src/styles/main.css`
- ✅ Created TypeScript type definitions in `src/types/index.ts`
- ✅ Migrated to Firebase SDK v10 (modular, tree-shakeable)
- ✅ Split code into modules:
  - `lib/auth.ts` - Authentication (Google sign-in)
  - `lib/firebase.ts` - Firebase initialization
  - `lib/firestore.ts` - Database operations
  - `lib/srs.ts` - Spaced repetition algorithm
  - `lib/keyboard.ts` - Hiragana keyboard component
  - `main.ts` - Application entry point

### 3. **Database Migration**
- ✅ Migrated from **Firebase Realtime Database** → **Firestore**
- ✅ Updated data structure for Firestore collections
- ✅ Implemented real-time listeners with `onSnapshot`
- ✅ User-scoped data: `/users/{userId}/cards/{cardId}`

### 4. **Firebase Functions**
- ✅ Initialized Cloud Functions with TypeScript
- ✅ Created Firestore trigger for automatic audio generation
- ✅ Integrated Google Cloud Text-to-Speech API
- ✅ Audio files uploaded to Cloud Storage at `/users/{userId}/audio/{cardId}.mp3`

### 5. **Security**
- ✅ Wrote **Firestore security rules** (user-specific access)
- ✅ Wrote **Storage security rules** (read-only for users, write-only for functions)
- ✅ Validated card data on creation
- ✅ Protected against unauthorized access

### 6. **CI/CD**
- ✅ Updated GitHub Actions workflows for Vite build
- ✅ Added environment variable support for builds
- ✅ Configured automatic deployment on merge to main
- ✅ Configured preview deployments for pull requests

### 7. **Build & Testing**
- ✅ Successful TypeScript compilation
- ✅ Successful Vite production build
- ✅ Output: 4.74 KB HTML + 6.50 KB CSS + 473 KB JS (113 KB gzipped)

## 📦 Project Structure

```
JANKI/
├── src/
│   ├── lib/              # Core modules
│   ├── styles/           # CSS files
│   ├── types/            # TypeScript types
│   └── main.ts           # Entry point
├── functions/            # Cloud Functions
│   └── src/index.ts      # TTS audio generation
├── dist/                 # Build output (Firebase serves from here)
├── index.html            # Vite entry point
├── .env                  # Environment variables
├── firebase.json         # Firebase configuration
├── firestore.rules       # Database security
├── storage.rules         # Storage security
└── README.md             # Documentation
```

## 🚀 Next Steps

### 1. Deploy to Firebase
```bash
firebase deploy
```

This will deploy:
- Hosting (from `dist/`)
- Cloud Functions (audio generation)
- Firestore rules
- Storage rules

### 2. Set Up GitHub Secrets

For CI/CD to work, add these secrets to your GitHub repository:
1. Go to: Settings → Secrets and variables → Actions
2. Add these secrets:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

(You can copy values from your `.env` file)

### 3. Enable Google Cloud TTS

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your Firebase project (`yanki-card`)
3. Enable **Cloud Text-to-Speech API**
4. The Cloud Function will use the default service account (no additional setup needed)

### 4. Test the App

```bash
# Local development
npm run dev

# Production build
npm run build

# Deploy
firebase deploy
```

Then:
1. Visit your Firebase Hosting URL
2. Sign in with Google
3. Import sample cards (use JSON format from README)
4. Verify audio generation works
5. Test a study session

## 📝 Important Notes

### Data Migration (Optional)
If you have existing data in Realtime Database, you'll need to migrate it:
1. Export from Realtime DB: `/cards` and `/progress`
2. Transform to Firestore structure
3. Import to Firestore: `/users/{userId}/cards/*`

### Firebase Project
- Current project: `yanki-card`
- `.firebaserc` has been updated to use this project
- All Firebase configs point to `yanki-card`

### Breaking Changes from Old App
- Database structure is different (Realtime DB → Firestore)
- Progress is now nested in card documents
- Audio URLs are generated automatically (no manual upload needed)

## 🎉 What You Get

1. **Modern Stack**: Vite + TypeScript + Firebase v10
2. **Better Performance**: Tree-shaking, code splitting, optimized bundles
3. **Type Safety**: Full TypeScript support
4. **Security**: User-scoped data with validation rules
5. **Automation**: Automatic audio generation via Cloud Functions
6. **CI/CD**: Automatic deployments via GitHub Actions
7. **Maintainability**: Modular code structure
8. **Scalability**: Firestore scales better than Realtime Database

## 🐛 Troubleshooting

See [README.md](README.md#troubleshooting) for common issues and solutions.

## 📚 Resources

- [Vite Documentation](https://vitejs.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Cloud Text-to-Speech API](https://cloud.google.com/text-to-speech/docs)
