import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Public: Add a correction from the results UI ──
export const addCorrection = mutation({
    args: {
        orderId: v.optional(v.id("orders")),
        type: v.union(
            v.literal("teach_term"),
            v.literal("wrong_match"),
            v.literal("manual_term"),
        ),
        termHeard: v.string(),
        termMeaning: v.string(),
        companyId: v.optional(v.string()),
    },
    returns: v.id("corrections"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("corrections", {
            orderId: args.orderId,
            type: args.type,
            termHeard: args.termHeard,
            termMeaning: args.termMeaning,
            companyId: args.companyId,
            status: "pending",
        });
    },
});

// ── Public: List pending corrections ──
export const listPending = query({
    args: {},
    returns: v.any(),
    handler: async (ctx) => {
        return await ctx.db
            .query("corrections")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect();
    },
});

// ── Public: List corrections for a specific order ──
export const listByOrder = query({
    args: { orderId: v.id("orders") },
    returns: v.any(),
    handler: async (ctx, args) => {
        return await ctx.db
            .query("corrections")
            .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
            .collect();
    },
});

// ── Public: List all corrections ──
export const listAll = query({
    args: {},
    returns: v.any(),
    handler: async (ctx) => {
        return await ctx.db.query("corrections").order("desc").take(100);
    },
});

// ── Public: Reject a correction ──
export const reject = mutation({
    args: { correctionId: v.id("corrections") },
    returns: v.null(),
    handler: async (ctx, args) => {
        await ctx.db.patch(args.correctionId, { status: "rejected" as const });
        return null;
    },
});
