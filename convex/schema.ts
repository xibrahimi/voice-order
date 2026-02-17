import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // ── Prompt Versioning ──
    // Each version stores the full system prompt text. Only one is "active" at a time.
    prompt_versions: defineTable({
        prompt: v.string(),
        version: v.number(),
        status: v.union(v.literal("active"), v.literal("archived")),
        source: v.union(
            v.literal("seed"),
            v.literal("admin_correction"),
            v.literal("admin_rollback"),
        ),
        changeDescription: v.string(),
        parentVersionId: v.optional(v.id("prompt_versions")),
    })
        .index("by_status", ["status"])
        .index("by_version", ["version"]),

    // ── Orders ──
    orders: defineTable({
        companyId: v.string(),
        companyName: v.string(),
        audioStorageId: v.id("_storage"),
        status: v.union(
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed"),
        ),
        promptVersionId: v.optional(v.id("prompt_versions")),
        error: v.optional(v.string()),
        transcript: v.optional(v.string()),
        rawGeminiResponse: v.optional(v.string()),
    })
        .index("by_companyId", ["companyId"])
        .index("by_status", ["status"]),

    // ── Order Items (matched products) ──
    order_items: defineTable({
        orderId: v.id("orders"),
        name: v.string(),
        size: v.string(),
        catalogPrice: v.number(),
        llmPrice: v.number(),
        quantity: v.number(),
        unit: v.string(),
        confidence: v.union(
            v.literal("high"),
            v.literal("medium"),
            v.literal("low"),
        ),
        notes: v.string(),
    }).index("by_orderId", ["orderId"]),

    // ── Unmatched Items ──
    unmatched_items: defineTable({
        orderId: v.id("orders"),
        heard: v.string(),
        reason: v.string(),
    }).index("by_orderId", ["orderId"]),

    // ── Corrections (admin feedback) ──
    corrections: defineTable({
        orderId: v.optional(v.id("orders")),
        type: v.union(
            v.literal("teach_term"),
            v.literal("wrong_match"),
            v.literal("manual_term"),
        ),
        termHeard: v.string(),
        termMeaning: v.string(),
        companyId: v.optional(v.string()),
        status: v.union(
            v.literal("pending"),
            v.literal("applied"),
            v.literal("rejected"),
        ),
        appliedToVersionId: v.optional(v.id("prompt_versions")),
    })
        .index("by_status", ["status"])
        .index("by_orderId", ["orderId"]),

    // ── Users (simple auth) ──
    users: defineTable({
        username: v.string(),
        password: v.string(),
        role: v.union(v.literal("admin"), v.literal("user")),
    }).index("by_username", ["username"]),
});
