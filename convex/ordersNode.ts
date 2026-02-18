"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { DEFAULT_SYSTEM_PROMPT } from "./systemPrompt";

// ── Internal: Fetch products from Sanity ──
export const fetchProductsInternal = internalAction({
    args: { companyId: v.string() },
    returns: v.any(),
    handler: async (_ctx, args) => {
        const proxyUrl = process.env.SANITY_PROXY_URL!;
        const apiKey = process.env.SANITY_PROXY_API_KEY!;
        const res = await fetch(proxyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({
                query: `*[_type == "product" && company._ref == "${args.companyId}"]{name, size, price} | order(name asc)`,
                params: {},
            }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Sanity query failed");
        return json.data;
    },
});

// ── Internal: Process order (main pipeline — needs Node.js for Buffer) ──
export const processOrder = internalAction({
    args: { orderId: v.id("orders") },
    returns: v.null(),
    handler: async (ctx, args) => {
        try {
            // 1. Get the order
            const order: any = await ctx.runQuery(internal.orders.getOrderRaw, {
                orderId: args.orderId,
            });
            if (!order) throw new Error("Order not found");

            // 2. Get active system prompt
            const activePrompt: any = await ctx.runQuery(
                internal.orders.getActivePrompt,
            );
            const systemPrompt = activePrompt?.prompt || DEFAULT_SYSTEM_PROMPT;
            const promptVersionId = activePrompt?._id;

            // 3. Fetch products from Sanity
            const products: any[] = await ctx.runAction(
                internal.ordersNode.fetchProductsInternal,
                { companyId: order.companyId },
            );

            // 4. Get audio from storage
            const audioUrl = await ctx.storage.getUrl(order.audioStorageId);
            if (!audioUrl) throw new Error("Audio file not found in storage");

            const audioResponse = await fetch(audioUrl);
            const audioBlob = await audioResponse.arrayBuffer();
            const audioBase64 = Buffer.from(audioBlob).toString("base64");

            // Detect the real MIME type from the storage response
            const contentType = audioResponse.headers.get("content-type") || "audio/ogg";
            // Strip any charset/params, keep just the MIME base (e.g. "audio/webm")
            const audioMimeType = contentType.split(";")[0].trim();

            // 5. Build catalog (pipe-delimited)
            const catalog = products
                .map((p: any) => `${p.name}|${p.size}|${p.price}`)
                .join("\n");

            // 6. Call Gemini 3 Flash
            const geminiApiKey = process.env.GEMINI_API_KEY!;
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`;

            const body = {
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [
                    {
                        parts: [
                            {
                                text: `PRODUCT CATALOG:\n${catalog}\n\nListen to this voice note and match products:`,
                            },
                            {
                                inlineData: { mimeType: audioMimeType, data: audioBase64 },
                            },
                        ],
                    },
                ],
                generationConfig: { responseMimeType: "application/json" },
            };

            const geminiRes = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!geminiRes.ok) {
                const err = await geminiRes.json();
                throw new Error(
                    err.error?.message || `Gemini API error: ${geminiRes.status}`,
                );
            }

            const data = await geminiRes.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("No response from Gemini");

            const result = JSON.parse(text);

            // 7. Validate prices against catalog
            const productMap = new Map<string, number>();
            for (const p of products) {
                productMap.set(`${p.name}|||${p.size}`, p.price);
            }

            const validatedItems = (result.items || []).map((item: any) => {
                const catalogPrice =
                    productMap.get(`${item.name}|||${item.size}`) ?? item.price;
                return {
                    name: item.name,
                    size: item.size,
                    catalogPrice,
                    llmPrice: item.price,
                    quantity: item.quantity,
                    unit: item.unit || "adad",
                    confidence: item.confidence || "medium",
                    notes: item.notes || "",
                };
            });

            const unmatchedItems = (result.unmatched || []).map((u: any) => ({
                heard: u.heard,
                reason: u.reason,
            }));

            // 8. Save results
            await ctx.runMutation(internal.orders.saveResults, {
                orderId: args.orderId,
                promptVersionId,
                rawGeminiResponse: text,
                transcript: result.transcript || "",
                items: validatedItems,
                unmatched: unmatchedItems,
            });
        } catch (error: any) {
            await ctx.runMutation(internal.orders.markFailed, {
                orderId: args.orderId,
                error: error.message || "Unknown error",
            });
        }
        return null;
    },
});
