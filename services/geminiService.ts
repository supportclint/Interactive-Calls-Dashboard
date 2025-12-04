import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

// Initialize Gemini API
// In a real production app, calls should likely be proxied through a backend to keep keys safe,
// or use a very restricted key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeCallTranscript = async (transcript: string): Promise<AIAnalysisResult> => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key missing. Returning mock data.");
    return {
      summary: "API Key missing: This is a simulated summary of the conversation.",
      sentiment: "neutral",
      keyPoints: ["Key point 1", "Key point 2"]
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the following call transcript. Provide a brief summary, determine the overall sentiment (positive, negative, or neutral), and list 3 key bullet points discussed.
      
      Transcript:
      "${transcript}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A short summary of the call." },
            sentiment: { type: Type.STRING, enum: ["positive", "neutral", "negative"], description: "Overall sentiment." },
            keyPoints: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of 3 key discussion points."
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as AIAnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return {
      summary: "Failed to analyze call due to an error.",
      sentiment: "neutral",
      keyPoints: []
    };
  }
};