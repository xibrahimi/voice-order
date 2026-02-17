import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Login: validate username + password against DB
export const login = query({
    args: { username: v.string(), password: v.string() },
    returns: v.any(),
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", args.username))
            .first();

        if (!user || user.password !== args.password) {
            return { success: false, error: "Invalid username or password" };
        }

        return {
            success: true,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
            },
        };
    },
});

// Seed a default admin user if none exist
export const seedAdmin = mutation({
    args: {},
    returns: v.any(),
    handler: async (ctx) => {
        const existing = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", "admin"))
            .first();

        if (existing) {
            return { status: "exists", message: "Admin user already exists" };
        }

        await ctx.db.insert("users", {
            username: "admin",
            password: "Vx#9kQ$mL2pR!7nW",
            role: "admin",
        });

        return { status: "created", message: "Default admin created" };
    },
});
