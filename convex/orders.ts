import {
    query,
    mutation,
    internalMutation,
    internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── Public: Generate upload URL for audio files ──
export const generateUploadUrl = mutation({
    args: {},
    returns: v.string(),
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    },
});

// ── Public: Create a new order and schedule processing ──
export const create = mutation({
    args: {
        companyId: v.string(),
        companyName: v.string(),
        audioStorageId: v.id("_storage"),
    },
    returns: v.id("orders"),
    handler: async (ctx, args) => {
        const orderId = await ctx.db.insert("orders", {
            companyId: args.companyId,
            companyName: args.companyName,
            audioStorageId: args.audioStorageId,
            status: "processing",
        });
        // Schedule async processing (action in ordersNode.ts)
        await ctx.scheduler.runAfter(0, internal.ordersNode.processOrder, {
            orderId,
        });
        return orderId;
    },
});

// ── Public: Get a single order with items (reactive subscription) ──
export const get = query({
    args: { orderId: v.id("orders") },
    returns: v.any(),
    handler: async (ctx, args) => {
        const order = await ctx.db.get(args.orderId);
        if (!order) return null;

        const items = await ctx.db
            .query("order_items")
            .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
            .collect();

        const unmatched = await ctx.db
            .query("unmatched_items")
            .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
            .collect();

        return { ...order, items, unmatched };
    },
});

// ── Public: List recent orders ──
export const list = query({
    args: { companyId: v.optional(v.string()) },
    returns: v.any(),
    handler: async (ctx, args) => {
        if (args.companyId) {
            return await ctx.db
                .query("orders")
                .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId!))
                .order("desc")
                .take(50);
        }
        return await ctx.db.query("orders").order("desc").take(50);
    },
});

// ── Public: List orders with full details (items, unmatched, audio URL) ──
export const listWithDetails = query({
    args: { companyId: v.optional(v.string()) },
    returns: v.any(),
    handler: async (ctx, args) => {
        let orders;
        if (args.companyId) {
            orders = await ctx.db
                .query("orders")
                .withIndex("by_companyId", (q) => q.eq("companyId", args.companyId!))
                .order("desc")
                .take(50);
        } else {
            orders = await ctx.db.query("orders").order("desc").take(50);
        }

        const results = [];
        for (const order of orders) {
            const items = await ctx.db
                .query("order_items")
                .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
                .collect();

            const unmatched = await ctx.db
                .query("unmatched_items")
                .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
                .collect();

            let audioUrl = null;
            if (order.audioStorageId) {
                audioUrl = await ctx.storage.getUrl(order.audioStorageId);
            }

            results.push({ ...order, items, unmatched, audioUrl });
        }
        return results;
    },
});

// ── Internal: Raw order fetch (for actions to use) ──
export const getOrderRaw = internalQuery({
    args: { orderId: v.id("orders") },
    returns: v.any(),
    handler: async (ctx, args) => {
        return await ctx.db.get(args.orderId);
    },
});

// ── Internal: Get active system prompt (for actions to use) ──
export const getActivePrompt = internalQuery({
    args: {},
    returns: v.any(),
    handler: async (ctx) => {
        return await ctx.db
            .query("prompt_versions")
            .withIndex("by_status", (q) => q.eq("status", "active"))
            .first();
    },
});

// ── Internal: Save results after processing ──
export const saveResults = internalMutation({
    args: {
        orderId: v.id("orders"),
        promptVersionId: v.optional(v.id("prompt_versions")),
        rawGeminiResponse: v.string(),
        transcript: v.optional(v.string()),
        items: v.array(v.any()),
        unmatched: v.array(v.any()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.orderId, {
            status: "completed" as const,
            promptVersionId: args.promptVersionId,
            rawGeminiResponse: args.rawGeminiResponse,
            transcript: args.transcript || "",
        });

        for (const item of args.items) {
            await ctx.db.insert("order_items", {
                orderId: args.orderId,
                name: item.name,
                size: item.size,
                catalogPrice: item.catalogPrice,
                llmPrice: item.llmPrice,
                quantity: item.quantity,
                unit: item.unit,
                confidence: item.confidence,
                notes: item.notes,
            });
        }

        for (const u of args.unmatched) {
            await ctx.db.insert("unmatched_items", {
                orderId: args.orderId,
                heard: u.heard,
                reason: u.reason,
            });
        }

        return null;
    },
});

// ── Internal: Mark order as failed ──
export const markFailed = internalMutation({
    args: { orderId: v.id("orders"), error: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.orderId, {
            status: "failed" as const,
            error: args.error,
        });
        return null;
    },
});
