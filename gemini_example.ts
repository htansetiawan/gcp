import {onCall, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {GoogleAuth} from "google-auth-library";

interface RequestData {
  base64Image: string;
  type: string;
}

interface GeminiRequest {
  contents: {
    role: string;
    parts: {
      inlineData?: {
        mimeType: string;
        data: string;
      };
      text?: string;
    }[];
  };
  generationConfig: {
    responseModalities: string[];
    temperature: number;
    maxOutputTokens: number;
    topP: number;
    responseMimeType?: string;
  };
  safetySettings: {
    category: string;
    threshold: string;
  }[];
}

// Get project ID from environment variables
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCLOUD_PROJECT;
const LOCATION_ID = "us-central1";
const API_ENDPOINT = "us-central1-aiplatform.googleapis.com";
const MODEL_ID = "gemini-2.0-flash-exp";
const GENERATE_CONTENT_API = "streamGenerateContent";

export const processTranscript = onCall(
  {region: "us-central1"},
  async (request: CallableRequest<RequestData>) => {
    console.log("Starting processTranscript function");
    try {
      const base64Image = request.data.base64Image;
      if (!base64Image) {
        console.error("No image data provided");
        throw new HttpsError("invalid-argument", "No image data provided");
      }
      console.log("Received base64 image, length:", base64Image.length);

      console.log("Initializing Google Auth");
      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });

      console.log("Getting auth client");
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      if (!accessToken.token) {
        console.error("Failed to get access token");
        throw new HttpsError("internal", "Failed to get access token");
      }
      console.log("Successfully obtained access token");
      const geminiRequest: GeminiRequest = {
        contents: {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: request.data.type,
                data: base64Image,
              },
            },
            {
              text: "<your prompt>",
            },
          ],
        },
        generationConfig: {
          responseModalities: ["text"],
          temperature: 1.0,
          maxOutputTokens: 8192,
          topP: 0.95,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "OFF",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "OFF",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "OFF",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "OFF",
          },
        ],
      };

      const apiUrl = `https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}`;
      console.log("Making request to Gemini API:", apiUrl);
      console.log("Request data:", JSON.stringify(geminiRequest, null, 2));
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken.token}`,
        },
        body: JSON.stringify(geminiRequest),
      });

      console.log("Gemini API response status:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error details:", {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
        });
        throw new HttpsError("internal", `Gemini API error: ${response.statusText}. Details: ${errorText}`);
      }

      const dataResponse = await response.json();
      console.log("Gemini API response:", JSON.stringify(dataResponse, null, 2));

      try {
        // Extract subjects from Gemini API response
        const combinedText = dataResponse
          .map((item:any)=> item.candidates?.[0]?.content?.parts?.[0]?.text || "")
          .join("")
          .replace(/```json|```/g, ""); // Remove markdown code markers

        const parsedData = JSON.parse(combinedText);
        // Implement the parsing here ...
        console.log("Parsed data:", subjects);
        return parsedData;
      } catch (parseError) {
        console.error("Error parsing Gemini API response:", parseError);
        console.error("Raw response data:", JSON.stringify(dataResponse, null, 2));
        throw new HttpsError(
          "internal",
          "Failed to parse transcript data"
        );
      }
    } catch (error) {
      console.error("Error processing transcript:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error instanceof Error ? error.message : "Unexpected error occurred");
    }
  }
);
