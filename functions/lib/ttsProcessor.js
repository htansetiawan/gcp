"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeSpeechFn = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const googleCloudApiKey = (0, params_1.defineSecret)('GOOGLE_CLOUD_API_KEY');
exports.synthesizeSpeechFn = (0, https_1.onCall)({
    secrets: [googleCloudApiKey]
}, async (request) => {
    var _a;
    console.log('[synthesizeSpeechFn] Starting function');
    try {
        // Verify authentication
        if (!request.auth) {
            console.log('[synthesizeSpeechFn] Authentication failed: No auth context');
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        console.log('[synthesizeSpeechFn] User authenticated:', request.auth.uid);
        const text = request.data.text;
        const languageCode = request.data.languageCode || 'en-GB';
        const voiceName = request.data.voiceName || 'en-GB-Journey-F';
        const speakingRate = request.data.speakingRate || 1.0;
        const pitch = request.data.pitch || 0;
        console.log('[synthesizeSpeechFn] Request parameters:', {
            textLength: text === null || text === void 0 ? void 0 : text.length,
            languageCode,
            voiceName,
            speakingRate,
            pitch
        });
        if (!text) {
            console.log('[synthesizeSpeechFn] Error: No text provided');
            throw new https_1.HttpsError('invalid-argument', 'Text is required');
        }
        // Get the API key from secrets
        const apiKey = googleCloudApiKey.value();
        if (!apiKey) {
            console.error('[synthesizeSpeechFn] Error: Google Cloud API key not configured');
            throw new https_1.HttpsError("failed-precondition", "Google Cloud API key not configured");
        }
        console.log('[synthesizeSpeechFn] API key retrieved successfully');
        const API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
        console.log('[synthesizeSpeechFn] Making request to Google TTS API:', {
            url: API_URL,
            textPreview: text.substring(0, 100) + '...',
            requestConfig: {
                languageCode,
                voiceName,
                speakingRate,
                pitch,
                effectsProfileId: ['headphone-class-device']
            }
        });
        // Call the Text-to-Speech API
        const response = await fetch(`${API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: { text },
                voice: {
                    languageCode,
                    name: voiceName,
                    ssmlGender: 'FEMALE'
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    pitch,
                    speakingRate,
                    effectsProfileId: ['headphone-class-device']
                },
            }),
        });
        console.log('[synthesizeSpeechFn] Google TTS API response status:', response.status);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('[synthesizeSpeechFn] Text-to-Speech API error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            if (((_a = errorData.error) === null || _a === void 0 ? void 0 : _a.status) === 'PERMISSION_DENIED') {
                throw new https_1.HttpsError('permission-denied', 'API access denied. Please ensure the Cloud Text-to-Speech API is enabled and the API key has proper permissions.');
            }
            throw new https_1.HttpsError('internal', `Failed to synthesize speech: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('[synthesizeSpeechFn] Successfully received API response');
        if (!data.audioContent) {
            console.error('[synthesizeSpeechFn] Error: No audio content in response');
            throw new https_1.HttpsError('internal', 'No audio content received from TTS API');
        }
        console.log('[synthesizeSpeechFn] Audio content received, preparing response');
        // Return the audio content
        const result = {
            success: true,
            audioContent: data.audioContent,
            fileName: `speech_${Date.now()}.mp3`
        };
        console.log('[synthesizeSpeechFn] Function completed successfully');
        return result;
    }
    catch (error) {
        console.error('[synthesizeSpeechFn] Error in function:', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', error instanceof Error ? error.message : 'An unknown error occurred');
    }
});
//# sourceMappingURL=ttsProcessor.js.map