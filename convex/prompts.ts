import {
    query,
    mutation,
    internalMutation,
    internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
    DEFAULT_SYSTEM_PROMPT,
    ensurePromptRequestsTranscript,
} from "./systemPrompt";

// ── Public: Get the currently active system prompt ──
export const getActive = query({
    args: {},
    returns: v.any(),
    handler: async (ctx) => {
        return await ctx.db
            .query("prompt_versions")
            .withIndex("by_status", (q) => q.eq("status", "active"))
            .first();
    },
});

// ── Public: Get prompt version history ──
export const getHistory = query({
    args: {},
    returns: v.any(),
    handler: async (ctx) => {
        return await ctx.db
            .query("prompt_versions")
            .withIndex("by_version")
            .order("desc")
            .take(50);
    },
});

// ── Public: Seed the initial system prompt ──
export const seed = mutation({
    // Keep optional arg for backward compatibility with older clients.
    args: { prompt: v.optional(v.string()) },
    returns: v.id("prompt_versions"),
    handler: async (ctx) => {
        const existing = await ctx.db
            .query("prompt_versions")
            .withIndex("by_version")
            .first();
        if (existing) throw new Error("Prompt already seeded");

        return await ctx.db.insert("prompt_versions", {
            prompt: ensurePromptRequestsTranscript(DEFAULT_SYSTEM_PROMPT),
            version: 1,
            status: "active",
            source: "seed",
            changeDescription: "Initial system prompt",
        });
    },
});

// ── Public: Rollback to a previous version ──
export const rollback = mutation({
    args: { versionId: v.id("prompt_versions") },
    returns: v.id("prompt_versions"),
    handler: async (ctx, args) => {
        const target = await ctx.db.get(args.versionId);
        if (!target) throw new Error("Version not found");

        const currentActive = await ctx.db
            .query("prompt_versions")
            .withIndex("by_status", (q) => q.eq("status", "active"))
            .first();
        if (currentActive) {
            await ctx.db.patch(currentActive._id, { status: "archived" as const });
        }

        const latest = await ctx.db
            .query("prompt_versions")
            .withIndex("by_version")
            .order("desc")
            .first();
        const nextVersion = (latest?.version ?? 0) + 1;

        return await ctx.db.insert("prompt_versions", {
            prompt: ensurePromptRequestsTranscript(target.prompt),
            version: nextVersion,
            status: "active",
            source: "admin_rollback",
            changeDescription: `Rolled back to v${target.version}`,
            parentVersionId: target._id,
        });
    },
});

// ── Public: Apply all pending corrections via LLM #2 ──
export const applyCorrections = mutation({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const pending = await ctx.db
            .query("corrections")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect();
        if (pending.length === 0) throw new Error("No pending corrections");

        // Schedule the LLM action (in promptsNode.ts)
        await ctx.scheduler.runAfter(0, internal.promptsNode.improvePrompt);
        return null;
    },
});

// ── Internal queries for the LLM action ──
export const getActiveInternal = internalQuery({
    args: {},
    returns: v.any(),
    handler: async (ctx) => {
        return await ctx.db
            .query("prompt_versions")
            .withIndex("by_status", (q) => q.eq("status", "active"))
            .first();
    },
});

export const getPendingCorrections = internalQuery({
    args: {},
    returns: v.any(),
    handler: async (ctx) => {
        return await ctx.db
            .query("corrections")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect();
    },
});

// ── Internal: Save the improved prompt ──
export const saveImprovedPrompt = internalMutation({
    args: {
        newPrompt: v.string(),
        correctionIds: v.array(v.id("corrections")),
        changeDescription: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const currentActive = await ctx.db
            .query("prompt_versions")
            .withIndex("by_status", (q) => q.eq("status", "active"))
            .first();
        if (currentActive) {
            await ctx.db.patch(currentActive._id, { status: "archived" as const });
        }

        const latest = await ctx.db
            .query("prompt_versions")
            .withIndex("by_version")
            .order("desc")
            .first();
        const nextVersion = (latest?.version ?? 0) + 1;

        const newVersionId = await ctx.db.insert("prompt_versions", {
            prompt: ensurePromptRequestsTranscript(args.newPrompt),
            version: nextVersion,
            status: "active",
            source: "admin_correction",
            changeDescription: args.changeDescription,
            parentVersionId: currentActive?._id,
        });

        for (const id of args.correctionIds) {
            await ctx.db.patch(id, {
                status: "applied" as const,
                appliedToVersionId: newVersionId,
            });
        }

        return null;
    },
});
