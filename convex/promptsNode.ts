"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── Internal: LLM #2 — Prompt Engineer ──
export const improvePrompt = internalAction({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        // 1. Get current active prompt
        const active: any = await ctx.runQuery(internal.prompts.getActiveInternal);
        if (!active) throw new Error("No active prompt found");

        // 2. Get pending corrections
        const pending: any[] = await ctx.runQuery(
            internal.prompts.getPendingCorrections,
        );
        if (pending.length === 0) return null;

        // 3. Format corrections
        const correctionsList = pending
            .map(
                (c: any) =>
                    `- Term heard: "${c.termHeard}" → Correct meaning: "${c.termMeaning}"${c.companyId ? ` (Company: ${c.companyId})` : ""}`,
            )
            .join("\n");

        // 4. Meta-prompt for LLM #2
        const metaPrompt = `You are a system prompt engineer. You maintain a system prompt used by an order-matching LLM that processes Urdu/Hindi/English voice notes for a Pakistani plumbing product distributor.

Your job: integrate NEW CORRECTIONS from human admins into the existing system prompt. The admin is a non-technical plumbing sales person who knows the local terminology better than any AI.

STRICT RULES:
1. NEVER remove any existing rules, domain knowledge, or instructions.
2. NEVER change the JSON response format specification.
3. NEVER change the tone or role description in the opening paragraph.
4. INTEGRATE the new correction naturally into the "Domain knowledge" section.
5. If the correction overlaps with an existing entry, MERGE them intelligently.
6. If the correction conflicts with an existing rule, ADD the new correction as a HIGHER-PRIORITY override.
7. Keep the prompt concise. Do not add verbose explanations.
8. Return ONLY the complete updated system prompt text. No commentary, no markdown, no explanation — just the raw prompt text.`;

        const userMessage = `CURRENT SYSTEM PROMPT:
"""
${active.prompt}
"""

NEW CORRECTION(S) FROM ADMIN:
${correctionsList}

Return the updated system prompt:`;

        // 5. Call Gemini 3 Flash
        const geminiApiKey = process.env.GEMINI_API_KEY!;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`;

        const body = {
            systemInstruction: { parts: [{ text: metaPrompt }] },
            contents: [{ parts: [{ text: userMessage }] }],
        };

        const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(
                err.error?.message || `Gemini API error: ${res.status}`,
            );
        }

        const data = await res.json();
        const newPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!newPrompt)
            throw new Error("No response from Gemini for prompt improvement");

        // 6. Save new version and mark corrections as applied
        const correctionIds = pending.map((c: any) => c._id);
        await ctx.runMutation(internal.prompts.saveImprovedPrompt, {
            newPrompt,
            correctionIds,
            changeDescription: `Applied ${pending.length} correction(s): ${pending.map((c: any) => c.termHeard).join(", ")}`,
        });

        return null;
    },
});
