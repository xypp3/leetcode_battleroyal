import { useState, useEffect } from "react";

interface Player {
  _id: string;
  name: string;
  status: string;
}

interface Room {
  status: string;
  startTime?: number;
  maxPlayers: number;
}

interface WaitingRoomProps {
  roomState: {
    room: Room;
    players: Player[];
    question: any;
  };
}

export function WaitingRoom({ roomState }: WaitingRoomProps) {
  const [countdown, setCountdown] = useState(10);
  const [gameStarting, setGameStarting] = useState(false);

  useEffect(() => {
    if (roomState.players.length >= 2 && !gameStarting) {
      setGameStarting(true);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [roomState.players.length, gameStarting]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-yellow-400 mb-4">
          🏟️ Interview Battle Royale
        </h1>
        <p className="text-xl text-gray-300">
          Waiting for warriors to join the battle...
        </p>
      </div>

      {gameStarting && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 mb-8 text-center">
          <h2 className="text-3xl font-bold text-red-400 mb-2">
            ⚡ BATTLE STARTING IN ⚡
          </h2>
          <div className="text-6xl font-bold text-yellow-400 animate-pulse">
            {countdown}
          </div>
          <p className="text-lg text-gray-300 mt-2">
            Get ready to code your way to victory!
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-2xl font-bold text-yellow-400 mb-4 flex items-center">
            👥 Players ({roomState.players.length}/{roomState.room.maxPlayers})
          </h3>
          <div className="space-y-3">
            {roomState.players.map((player, index) => (
              <div
                key={player._id}
                className="flex items-center justify-between bg-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-black font-bold">
                    {index + 1}
                  </div>
                  <span className="font-semibold">{player.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-400">Ready</span>
                </div>
              </div>
            ))}
            
            {/* Empty slots */}
            {Array.from({ length: roomState.room.maxPlayers - roomState.players.length }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3 border-2 border-dashed border-gray-600"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-gray-400">
                    {roomState.players.length + index + 1}
                  </div>
                  <span className="text-gray-500 italic">Waiting for player...</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-2xl font-bold text-yellow-400 mb-4 flex items-center">
            📋 Battle Rules
          </h3>
          <div className="space-y-4 text-gray-300">
            <div className="flex items-start space-x-3">
              <span className="text-yellow-400 font-bold">1.</span>
              <p>Solve the LeetCode problem as fast as possible</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-yellow-400 font-bold">2.</span>
              <p>All test cases must pass to complete the challenge</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-yellow-400 font-bold">3.</span>
              <p>First to solve wins the round!</p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-yellow-400 font-bold">4.</span>
              <p>JavaScript only - no external libraries</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-700 rounded-lg">
            <h4 className="font-bold text-yellow-400 mb-2">💡 Pro Tips:</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Read the problem carefully</li>
              <li>• Test your code before submitting</li>
              <li>• Think about edge cases</li>
              <li>• Speed matters, but correctness is key!</li>
            </ul>
          </div>
        </div>
      </div>

      {!gameStarting && roomState.players.length < 2 && (
        <div className="text-center mt-8">
          <p className="text-lg text-gray-400">
            Need at least 2 players to start the battle. Share this room with friends!
          </p>
          <div className="mt-4 p-4 bg-gray-800 rounded-lg inline-block">
            <p className="text-sm text-gray-500">Room ID:</p>
            <code className="text-yellow-400 font-mono text-lg">{roomState.room.status}</code>
          </div>
        </div>
      )}
    </div>
  );
}
