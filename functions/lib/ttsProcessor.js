"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeSpeech = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const googleCloudApiKey = (0, params_1.defineSecret)('GOOGLE_CLOUD_API_KEY');
exports.synthesizeSpeech = (0, https_1.onCall)({ region: 'us-central1', secrets: [googleCloudApiKey] }, async (request) => {
    var _a, _b;
    try {
        // Verify authentication
        if (!request.auth) {
            console.error("Unauthorized: User must be authenticated");
            throw new https_1.HttpsError("unauthenticated", "User must be authenticated");
        }
        const { text, languageCode = 'en-GB', voiceName = 'en-GB-Journey-F', speakingRate = 1.0 } = request.data;
        if (!text) {
            console.error("No text content provided");
            throw new https_1.HttpsError("invalid-argument", "Text content is required");
        }
        // Get the API key from secrets
        const apiKey = googleCloudApiKey.value();
        if (!apiKey) {
            console.error("Google Cloud API key not configured");
            throw new https_1.HttpsError("failed-precondition", "Google Cloud API key not configured");
        }
        const API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
        // Prepare the request body
        const requestBody = {
            input: { text },
            voice: {
                languageCode,
                name: voiceName,
                ssmlGender: 'FEMALE'
            },
            audioConfig: {
                audioEncoding: 'MP3',
                pitch: 0,
                speakingRate,
                effectsProfileId: ['headphone-class-device']
            },
        };
        console.log("Making request to Google TTS API:", API_URL);
        console.log("Request data:", JSON.stringify(requestBody, null, 2));
        // Make the API request
        const response = await fetch(`${API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });
        console.log("TTS API response status:", response.status, response.statusText);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Text-to-Speech API error:', JSON.stringify(errorData, null, 2));
            // Check for specific error types
            if (((_a = errorData.error) === null || _a === void 0 ? void 0 : _a.status) === 'PERMISSION_DENIED') {
                throw new https_1.HttpsError('permission-denied', 'API access denied. Please ensure the Cloud Text-to-Speech API is enabled and the API key has proper permissions.');
            }
            throw new https_1.HttpsError('internal', `Failed to synthesize speech: ${((_b = errorData.error) === null || _b === void 0 ? void 0 : _b.message) || 'Unknown error'}`);
        }
        const responseData = await response.json();
        console.log("TTS API response received");
        if (!responseData.audioContent) {
            console.error("No audio content in response");
            throw new https_1.HttpsError("internal", "No audio content received from TTS API");
        }
        console.log("Successfully generated audio");
        // Return the audio content directly as base64
        return {
            success: true,
            url: `data:audio/mp3;base64,${responseData.audioContent}`,
            fileName: 'speech.mp3'
        };
    }
    catch (error) {
        console.error("Error in synthesizeSpeech:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', error instanceof Error ? error.message : 'An unknown error occurred');
    }
});
//# sourceMappingURL=ttsProcessor.js.map