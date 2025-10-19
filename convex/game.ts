import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Configuration - Edit this for testing different time limits
const MAX_TIME_REMAINING = 240; // 5 minutes in seconds

export const checkWinnerStatus = query({
  args: { roomId: v.id("rooms") },
  returns: v.object({
    activePlayers: v.array(v.object({
      _id: v.id("players"),
      name: v.string(),
      status: v.string(),
      roundsWon: v.optional(v.number()),
    })),
    isGameOver: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const activePlayers = players.filter(p => p.status !== "eliminated");
    
    return {
      activePlayers: activePlayers.map(p => ({
        _id: p._id,
        name: p.name,
        status: p.status,
        roundsWon: p.roundsWon,
      })),
      isGameOver: activePlayers.length === 1,
    };
  },
});

export const createRoom = mutation({
  args: { playerName: v.string() },
  handler: async (ctx, args) => {
    // Find existing waiting room or create new one
    const existingRoom = await ctx.db
      .query("rooms")
      .filter((q) => q.eq(q.field("status"), "waiting"))
      .first();

    let roomId;
    if (existingRoom) {
      const playerCount = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", existingRoom._id))
        .collect();
      
      if (playerCount.length < existingRoom.maxPlayers) {
        roomId = existingRoom._id;
      } else {
        // Create new room if existing is full
        roomId = await ctx.db.insert("rooms", {
          status: "waiting",
          maxPlayers: 8,
          currentRound: 0,
          maxRounds: 3,
        });
      }
    } else {
      roomId = await ctx.db.insert("rooms", {
        status: "waiting",
        maxPlayers: 8,
        currentRound: 0,
        maxRounds: 3,
      });
    }

    // Add player to room
    const playerId = await ctx.db.insert("players", {
      roomId,
      name: args.playerName,
      status: "waiting",
      roundsWon: 0,
      timeRemaining: MAX_TIME_REMAINING,
    });

    // Check if room should start (2+ players for demo, normally would be more)
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    if (players.length >= 2) {
      await ctx.scheduler.runAfter(10000, internal.game.startGame, { roomId });
    }

    return { roomId, playerId };
  },
});

export const getRoomState = query({
  args: { roomId: v.id("rooms"), playerId: v.optional(v.id("players")) },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    let question = null;
    // Get the current player's question if playerId is provided
    if (args.playerId && players) {
      const currentPlayer = players.find(p => p._id === args.playerId);
      if (currentPlayer?.currentQuestionId) {
        question = await ctx.db
          .query("questions")
          .filter((q) => q.eq(q.field("title"), currentPlayer.currentQuestionId))
          .first();
      }
    }

    // Get recent attacks for animation triggers
    const recentAttacks = await ctx.db
      .query("attacks")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.gt(q.field("timestamp"), Date.now() - 5000)) // Last 5 seconds
      .collect();

    return {
      room,
      players,
      question,
      recentAttacks,
    };
  },
});

export const submitCode = mutation({
  args: { 
    playerId: v.id("players"), 
    code: v.string(),
    testsPassed: v.number(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    const room = await ctx.db.get(player.roomId);
    if (!room) throw new Error("Room not found");

    const isCompleted = args.testsPassed === 3;
    
    await ctx.db.patch(args.playerId, {
      code: args.code,
      testsPassed: args.testsPassed,
      status: isCompleted ? "completed" : "playing",
      completionTime: isCompleted ? Date.now() : undefined,
    });

    // If player completed the round
    if (isCompleted) {
      // Schedule the random attack to happen immediately as a separate server operation
      await ctx.scheduler.runAfter(0, internal.game.performRandomAttack, { 
        playerId: args.playerId,
        roomId: player.roomId,
      });
    }

    return { success: true };
  },
});

export const attackPlayer = mutation({
  args: {
    attackerId: v.id("players"),
    targetId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const attacker = await ctx.db.get(args.attackerId);
    const target = await ctx.db.get(args.targetId);
    
    if (!attacker || !target) {
      throw new Error("Player not found");
    }

    if (attacker.roomId !== target.roomId) {
      throw new Error("Players not in same room");
    }

    // Check if attacker can attack (completed a problem recently)
    if (attacker.status !== "completed") {
      throw new Error("Must complete a problem to attack");
    }

    // Check cooldown (can only attack once per completion)
    if (attacker.lastAttackTime && attacker.completionTime && 
        attacker.lastAttackTime >= attacker.completionTime) {
      throw new Error("Already used attack for this completion");
    }

    // Reduce target's time by 20 seconds
    const newTimeRemaining = Math.max(0, (target.timeRemaining || MAX_TIME_REMAINING) - 20);
    
    await ctx.db.patch(args.targetId, {
      timeRemaining: newTimeRemaining,
    });

    await ctx.db.patch(args.attackerId, {
      lastAttackTime: Date.now(),
    });

    // Record the attack for animation
    await ctx.db.insert("attacks", {
      roomId: attacker.roomId,
      attackerId: args.attackerId,
      targetId: args.targetId,
      timestamp: Date.now(),
      timeReduction: 20,
    });

    // If target runs out of time, eliminate them
    if (newTimeRemaining <= 0) {
      await ctx.db.patch(args.targetId, {
        status: "eliminated",
      });
    }

    return { success: true };
  },
});

export const updatePlayerTime = mutation({
  args: {
    playerId: v.id("players"),
    timeRemaining: v.number(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    // If time runs out, eliminate player
    if (args.timeRemaining <= 0) {
      await ctx.db.patch(args.playerId, {
        status: "eliminated",
        timeRemaining: 0,
      });
    } else {
      await ctx.db.patch(args.playerId, {
        timeRemaining: args.timeRemaining,
      });
    }

    return { success: true };
  },
});

export const startGame = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "waiting") return;

    // Get all questions
    const questions = await ctx.db.query("questions").collect();
    
    await ctx.db.patch(args.roomId, {
      status: "active",
      startTime: Date.now(),
      currentRound: 1,
    });

    // Update all players to playing status and assign individual questions
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    for (const player of players) {
      const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
      await ctx.db.patch(player._id, { 
        status: "playing",
        timeRemaining: MAX_TIME_REMAINING,
        roundsWon: 0,
        currentQuestionId: randomQuestion?.title || "Two Sum",
      });
    }
  },
});

export const nextRound = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    // Check if game should continue
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const activePlayers = players.filter(p => p.status !== "eliminated" && p.status !== "winner");
    
    if (activePlayers.length <= 1) {
      // Game over
      await ctx.db.patch(args.roomId, {
        status: "finished",
      });
      return;
    }

    await ctx.db.patch(args.roomId, {
      startTime: Date.now(),
      currentRound: (room.currentRound || 0) + 1,
    });

    // Transition "completed" players back to "playing"
    // Their new question and reset code were already assigned in submitCode
    for (const player of activePlayers) {
      if (player.status === "completed") {
        // Just transition to playing - the new question was already assigned
        await ctx.db.patch(player._id, {
          timeRemaining: MAX_TIME_REMAINING,
          status: "playing",
        });
      }
      // Players still working on their challenge keep their current state
    }
  },
});

export const seedQuestions = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if questions already exist
    const existing = await ctx.db.query("questions").first();
    if (existing) return { message: "Questions already seeded" };

    // Seed some basic questions
    await ctx.db.insert("questions", {
      title: "Two Sum",
      description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
      difficulty: "Easy",
      functionName: "twoSum",
      parameters: ["nums", "target"],
      returnType: "number[]",
      testCases: [
        { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
        { input: [[3, 2, 4], 6], expected: [1, 2] },
        { input: [[3, 3], 6], expected: [0, 1] },
      ],
      starterCode: `function twoSum(nums, target) {
    // Your code here
    
}`,
    });

    await ctx.db.insert("questions", {
      title: "Palindrome Number",
      description: "Given an integer x, return true if x is a palindrome, and false otherwise.",
      difficulty: "Easy",
      functionName: "isPalindrome",
      parameters: ["x"],
      returnType: "boolean",
      testCases: [
        { input: [121], expected: true },
        { input: [-121], expected: false },
        { input: [10], expected: false },
      ],
      starterCode: `function isPalindrome(x) {
    // Your code here
    
}`,
    });

    await ctx.db.insert("questions", {
      title: "Valid Parentheses",
      description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
      difficulty: "Easy",
      functionName: "isValid",
      parameters: ["s"],
      returnType: "boolean",
      testCases: [
        { input: ["()"], expected: true },
        { input: ["()[]{}"], expected: true },
        { input: ["(]"], expected: false },
      ],
      starterCode: `function isValid(s) {
    // Your code here
    
}`,
    });

    await ctx.db.insert("questions", {
      title: "Reverse Integer",
      description: "Given a signed 32-bit integer x, return x with its digits reversed.",
      difficulty: "Medium",
      functionName: "reverse",
      parameters: ["x"],
      returnType: "number",
      testCases: [
        { input: [123], expected: 321 },
        { input: [-123], expected: -321 },
        { input: [120], expected: 21 },
      ],
      starterCode: `function reverse(x) {
    // Your code here
    
}`,
    });

    await ctx.db.insert("questions", {
      title: "Longest Common Prefix",
      description: "Write a function to find the longest common prefix string amongst an array of strings.",
      difficulty: "Easy",
      functionName: "longestCommonPrefix",
      parameters: ["strs"],
      returnType: "string",
      testCases: [
        { input: [["flower","flow","flight"]], expected: "fl" },
        { input: [["dog","racecar","car"]], expected: "" },
        { input: [["interspecies","interstellar","interstate"]], expected: "inters" },
      ],
      starterCode: `function longestCommonPrefix(strs) {
    // Your code here
    
}`,
    });

    return { message: "Questions seeded successfully" };
  },
});

export const performRandomAttack = internalMutation({
  args: {
    playerId: v.id("players"),
    roomId: v.id("rooms"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    // Get all other active players to potentially attack
    const allPlayers = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const activePlayers = allPlayers.filter(p => 
      p.status !== "eliminated" && p._id !== args.playerId
    );

    // Randomly attack another active player
    if (activePlayers.length > 0) {
      const targetIndex = Math.floor(Math.random() * activePlayers.length);
      const target = activePlayers[targetIndex];
      
      // Reduce target's time by 20 seconds
      const newTimeRemaining = Math.max(0, (target.timeRemaining || MAX_TIME_REMAINING) - 20);
      
      await ctx.db.patch(target._id, {
        timeRemaining: newTimeRemaining,
      });

      // Record the attack for animation
      await ctx.db.insert("attacks", {
        roomId: args.roomId,
        attackerId: args.playerId,
        targetId: target._id,
        timestamp: Date.now(),
        timeReduction: 20,
      });

      // If target runs out of time, eliminate them
      if (newTimeRemaining <= 0) {
        await ctx.db.patch(target._id, {
          status: "eliminated",
        });

        // Check if only one player remains (after eliminating target)
        const remainingPlayers = allPlayers.filter(p => 
          p.status !== "eliminated" && p._id !== target._id
        );
        
        if (remainingPlayers.length === 1) {
          // Current player is the winner - they're the last one standing
          await ctx.db.patch(args.playerId, {
            status: "winner",
          });
          
          await ctx.db.patch(args.roomId, {
            status: "finished",
          });
          return;
        }
      }
    }

    // Get a new random question for the player
    const questions = await ctx.db.query("questions").collect();
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    
    // Clear all data and assign new question
    const currentPlayer = await ctx.db.get(args.playerId);
    await ctx.db.patch(args.playerId, {
      roundsWon: (currentPlayer?.roundsWon || 0) + 1,
      timeRemaining: MAX_TIME_REMAINING, // Reset timer
      currentQuestionId: randomQuestion?.title || "Two Sum",
      code: undefined, // Clear code so starter code loads
      testsPassed: 0,
      completionTime: undefined,
      lastAttackTime: undefined,
      status: "playing",
    });

    // Check if all other active players have also completed this round
    const allPlayersAfterAttack = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const activePlayersAfterAttack = allPlayersAfterAttack.filter(p => 
      p.status !== "eliminated" && p.status !== "winner"
    );

    const allCompleted = activePlayersAfterAttack.every(p =>
      p._id === args.playerId || p.status === "completed"
    );

    // If all remaining players have completed, move to next round
    if (allCompleted && activePlayersAfterAttack.length > 1) {
      await ctx.scheduler.runAfter(5000, internal.game.nextRound, { 
        roomId: args.roomId 
      });
    }
  },
});
