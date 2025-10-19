import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { WaitingRoom } from "./WaitingRoom";
import { GameArena } from "./GameArena";
import { Id } from "../../convex/_generated/dataModel";

export function GameLobby() {
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState<Id<"rooms"> | null>(null);
  const [playerId, setPlayerId] = useState<Id<"players"> | null>(null);
  const [showNameInput, setShowNameInput] = useState(true);

  const createRoom = useMutation(api.game.createRoom);
  const seedQuestions = useMutation(api.game.seedQuestions);
  const roomState = useQuery(api.game.getRoomState, roomId && playerId ? { roomId, playerId } : "skip");

  useEffect(() => {
    // Seed questions on component mount
    seedQuestions();
  }, [seedQuestions]);

  const handleJoinGame = async () => {
    if (!playerName.trim()) return;
    
    try {
      const result = await createRoom({ playerName: playerName.trim() });
      setRoomId(result.roomId);
      setPlayerId(result.playerId);
      setShowNameInput(false);
    } catch (error) {
      console.error("Failed to join game:", error);
    }
  };

  if (showNameInput) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
          <h2 className="text-3xl font-bold text-yellow-400 mb-6 text-center">
            Interview Battle Royale
          </h2>
          <div className="space-y-4">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your battle name..."
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-yellow-400 focus:outline-none"
              maxLength={20}
              onKeyPress={(e) => e.key === "Enter" && handleJoinGame()}
            />
            <button
              onClick={handleJoinGame}
              disabled={!playerName.trim()}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Enter Battle Arena ⚔️
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (roomState.room.status === "waiting") {
    return <WaitingRoom roomState={roomState} />;
  }

  if (roomState.room.status === "active" && playerId) {
    return <GameArena roomState={roomState} playerId={playerId} />;
  }

  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-red-400">Game Error</h2>
      <p className="text-gray-400">Something went wrong. Please refresh and try again.</p>
    </div>
  );
}
