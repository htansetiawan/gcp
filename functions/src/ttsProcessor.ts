import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const googleCloudApiKey = defineSecret('GOOGLE_CLOUD_API_KEY');

interface TTSResponse {
  success: boolean;
  audioContent: string;
  fileName: string;
}

export const synthesizeSpeechFn = onCall(
  { 
    secrets: [googleCloudApiKey]
  },
  async (request) => {
    console.log('[synthesizeSpeechFn] Starting function');
    try {
      // Verify authentication
      if (!request.auth) {
        console.log('[synthesizeSpeechFn] Authentication failed: No auth context');
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }
      console.log('[synthesizeSpeechFn] User authenticated:', request.auth.uid);

      const text = request.data.text;
      const languageCode = request.data.languageCode || 'en-GB';
      const voiceName = request.data.voiceName || 'en-GB-Journey-F';
      const speakingRate = request.data.speakingRate || 1.0;
      const pitch = request.data.pitch || 0;

      console.log('[synthesizeSpeechFn] Request parameters:', {
        textLength: text?.length,
        languageCode,
        voiceName,
        speakingRate,
        pitch
      });

      if (!text) {
        console.log('[synthesizeSpeechFn] Error: No text provided');
        throw new HttpsError('invalid-argument', 'Text is required');
      }

      // Get the API key from secrets
      const apiKey = googleCloudApiKey.value();
      if (!apiKey) {
        console.error('[synthesizeSpeechFn] Error: Google Cloud API key not configured');
        throw new HttpsError("failed-precondition", "Google Cloud API key not configured");
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
      const response = await fetch(
        `${API_URL}?key=${apiKey}`,
        {
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
        }
      );

      console.log('[synthesizeSpeechFn] Google TTS API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[synthesizeSpeechFn] Text-to-Speech API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        if (errorData.error?.status === 'PERMISSION_DENIED') {
          throw new HttpsError(
            'permission-denied',
            'API access denied. Please ensure the Cloud Text-to-Speech API is enabled and the API key has proper permissions.'
          );
        }
        
        throw new HttpsError('internal', `Failed to synthesize speech: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[synthesizeSpeechFn] Successfully received API response');
      
      if (!data.audioContent) {
        console.error('[synthesizeSpeechFn] Error: No audio content in response');
        throw new HttpsError('internal', 'No audio content received from TTS API');
      }

      console.log('[synthesizeSpeechFn] Audio content received, preparing response');
      
      // Return the audio content
      const result = {
        success: true,
        audioContent: data.audioContent,
        fileName: `speech_${Date.now()}.mp3`
      } satisfies TTSResponse;

      console.log('[synthesizeSpeechFn] Function completed successfully');
      return result;

    } catch (error) {
      console.error('[synthesizeSpeechFn] Error in function:', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      });

      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    }
  }
);
