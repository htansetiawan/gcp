import * as admin from 'firebase-admin';

// Initialize Firebase Admin at the entry point
admin.initializeApp();

// Export all functions
export * from './ttsProcessor';
