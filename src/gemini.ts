import type { Product, GeminiResult, AudioData } from "./types";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const MODEL = "gemini-3-flash-preview";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are a plumbing product order assistant for a Pakistani building materials distributor.
You receive a voice note (audio) and a product catalog. The speaker uses Urdu, Hindi, English, or a mix.

Extract every product request and match against the catalog (pipe-delimited: name|size|price).

Domain knowledge:
- 1 naali = 6 meters (pipe length). "adad" = pieces.
- aadha=1/2", pauna=3/4", dedh=1-1/2", dhai=2-1/2"
- elbow/L/moad, tee/T, socket/jodd, union, adapter/V.socket, end cap, reducer bush, P-trap, P-elbow, P-tee, Y-tee, floor trap, clean insert
- "gond"/"solution" = Weld-On solvent cement
- SCH-40 (schedule chalees), SCH-80 (schedule assi), SDR ratings
- Reducer bushes have dual sizes: "do inch se ek inch" = 2" X 1"
- If speaker doesn't specify material (UPVC/CPVC) or schedule, default to UPVC SCH-40 and note the assumption.
- ONLY return products from the catalog. Never invent.

JSON response format:
{"items":[{"name":"exact catalog name","size":"catalog size","price":number,"quantity":number,"unit":"naali or adad","confidence":"high|medium|low","notes":"any assumption"}],"unmatched":[{"heard":"what was said","reason":"why no match"}]}`;

export async function matchProducts(audio: AudioData, products: Product[]): Promise<GeminiResult> {
    // Compact catalog to save tokens
    const catalog = products.map((p) => `${p.name}|${p.size}|${p.price}`).join("\n");

    const body = {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
            {
                parts: [
                    { text: `PRODUCT CATALOG:\n${catalog}\n\nListen to this voice note and match products:` },
                    { inlineData: { mimeType: audio.mimeType, data: audio.base64 } },
                ],
            },
        ],
        generationConfig: { responseMimeType: "application/json" },
    };

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as GeminiResult;
}
