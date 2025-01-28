import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const googleCloudApiKey = defineSecret('GOOGLE_CLOUD_API_KEY');

interface TTSRequest {
  text: string;
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number;
}

interface TTSResponse {
  success: boolean;
  url: string;
  fileName: string;
}

export const synthesizeSpeech = onCall(
  { region: 'us-central1', secrets: [googleCloudApiKey] },
  async (request: CallableRequest<TTSRequest>) => {
    try {
      // Verify authentication
      if (!request.auth) {
        console.error("Unauthorized: User must be authenticated");
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const { text, languageCode = 'en-GB', voiceName = 'en-GB-Journey-F', speakingRate = 1.0 } = request.data;

      if (!text) {
        console.error("No text content provided");
        throw new HttpsError("invalid-argument", "Text content is required");
      }

      // Get the API key from secrets
      const apiKey = googleCloudApiKey.value();
      if (!apiKey) {
        console.error("Google Cloud API key not configured");
        throw new HttpsError("failed-precondition", "Google Cloud API key not configured");
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
        if (errorData.error?.status === 'PERMISSION_DENIED') {
          throw new HttpsError(
            'permission-denied',
            'API access denied. Please ensure the Cloud Text-to-Speech API is enabled and the API key has proper permissions.'
          );
        }
        
        throw new HttpsError('internal', `Failed to synthesize speech: ${errorData.error?.message || 'Unknown error'}`);
      }

      const responseData = await response.json();
      console.log("TTS API response received");

      if (!responseData.audioContent) {
        console.error("No audio content in response");
        throw new HttpsError("internal", "No audio content received from TTS API");
      }

      console.log("Successfully generated audio");
      
      // Return the audio content directly as base64
      return {
        success: true,
        url: `data:audio/mp3;base64,${responseData.audioContent}`,
        fileName: 'speech.mp3'
      } satisfies TTSResponse;

    } catch (error) {
      console.error("Error in synthesizeSpeech:", error);
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
