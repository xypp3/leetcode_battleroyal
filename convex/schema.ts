import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  rooms: defineTable({
    status: v.union(v.literal("waiting"), v.literal("active"), v.literal("finished")),
    startTime: v.optional(v.number()),
    questionId: v.optional(v.string()),
    maxPlayers: v.number(),
    currentRound: v.optional(v.number()),
    maxRounds: v.optional(v.number()),
  }),
  
  players: defineTable({
    roomId: v.id("rooms"),
    name: v.string(),
    userId: v.optional(v.id("users")),
    status: v.union(v.literal("waiting"), v.literal("playing"), v.literal("completed"), v.literal("eliminated"), v.literal("winner")),
    completionTime: v.optional(v.number()),
    code: v.optional(v.string()),
    testsPassed: v.optional(v.number()),
    roundsWon: v.optional(v.number()),
    timeRemaining: v.optional(v.number()),
    lastAttackTime: v.optional(v.number()),
    currentQuestionId: v.optional(v.string()),
  }).index("by_room", ["roomId"]),

  questions: defineTable({
    title: v.string(),
    description: v.string(),
    difficulty: v.string(),
    functionName: v.string(),
    parameters: v.array(v.string()),
    returnType: v.string(),
    testCases: v.array(v.object({
      input: v.array(v.any()),
      expected: v.any(),
    })),
    starterCode: v.string(),
  }),

  attacks: defineTable({
    roomId: v.id("rooms"),
    attackerId: v.id("players"),
    targetId: v.id("players"),
    timestamp: v.number(),
    timeReduction: v.number(),
  }).index("by_room", ["roomId"])
    .index("by_target", ["targetId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
