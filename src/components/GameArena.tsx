import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CodeEditor } from "./CodeEditor";
import { Id } from "../../convex/_generated/dataModel";

interface GameArenaProps {
  roomState: any;
  playerId: Id<"players">;
}

interface Confetti {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
}

export function GameArena({ roomState, playerId }: GameArenaProps) {
  const [code, setCode] = useState("");
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [isAttacked, setIsAttacked] = useState(false);
  const [lastAttackId, setLastAttackId] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<Confetti[]>([]);

  const submitCode = useMutation(api.game.submitCode);
  const updatePlayerTime = useMutation(api.game.updatePlayerTime);
  
  // Query to check winner status
  const winnerStatus = useQuery(api.game.checkWinnerStatus, {
    roomId: roomState.room._id,
  });

  const currentPlayer = roomState.players.find((p: any) => p._id === playerId);
  const question = roomState.question;
  
  // Determine if current player is the winner
  const isWinner = winnerStatus && 
    winnerStatus.isGameOver && 
    winnerStatus.activePlayers.length === 1 &&
    winnerStatus.activePlayers[0]._id === playerId;

  // Load starter code when question changes
  useEffect(() => {
    if (question) {
      setCode(question.starterCode);
      setTestResults([]);
    }
  }, [question?.title]);

  useEffect(() => {
    if (roomState.room.startTime) {
      const timer = setInterval(() => {
        setGameTime(Math.floor((Date.now() - roomState.room.startTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [roomState.room.startTime]);

  // Timer countdown
  useEffect(() => {
    if (currentPlayer?.status === "playing" && currentPlayer?.timeRemaining !== undefined) {
      setTimeRemaining(currentPlayer.timeRemaining);
      
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = Math.max(0, prev - 1);
          
          // Update backend every 5 seconds or when time runs out
          if (newTime % 5 === 0 || newTime === 0) {
            updatePlayerTime({ playerId, timeRemaining: newTime });
          }
          
          return newTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentPlayer?.status, currentPlayer?.timeRemaining, playerId, updatePlayerTime]);

  // Sync local timer state when backend timer resets
  useEffect(() => {
    if (currentPlayer?.timeRemaining === 300 && timeRemaining < 250) {
      setTimeRemaining(300);
    }
  }, [currentPlayer?.timeRemaining, timeRemaining]);

  // Trigger confetti when player wins
  useEffect(() => {
    if (isWinner && confetti.length === 0) {
      const confettiPieces: Confetti[] = [];
      const colors = ["#fbbf24", "#60a5fa", "#34d399", "#f87171", "#c084fc", "#fb7185"];
      
      for (let i = 0; i < 50; i++) {
        confettiPieces.push({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 0.3,
          duration: 2 + Math.random() * 1,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
      
      setConfetti(confettiPieces);
    }
  }, [isWinner, confetti.length]);

  // Check for attacks
  useEffect(() => {
    if (roomState.recentAttacks) {
      const attackOnMe = roomState.recentAttacks.find(
        (attack: any) => attack.targetId === playerId && attack._id !== lastAttackId
      );
      
      if (attackOnMe) {
        setLastAttackId(attackOnMe._id);
        setIsAttacked(true);
        setTimeRemaining(prev => Math.max(0, prev - attackOnMe.timeReduction));
        
        // Reset animation after half a second
        setTimeout(() => setIsAttacked(false), 500);
      }
    }
  }, [roomState.recentAttacks, playerId, lastAttackId]);

  // Early exit if player is eliminated
  if (currentPlayer?.status === "eliminated") {
    return (
      <div>
        {/* Blur backdrop */}
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        
        {/* Eliminated screen */}
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gradient-to-br from-red-900 via-red-800 to-red-900 border-2 border-red-400 rounded-2xl p-8 text-center max-w-2xl shadow-2xl">
            <div className="mb-2 text-sm text-red-300 font-semibold">Interview Battle Royale</div>
            <div className="mb-4 text-6xl">📋</div>
            <h2 className="text-5xl font-bold text-red-300 mb-4 drop-shadow-lg">
              Thank you for your interest but
            </h2>
            <p className="text-xl text-red-200 mb-4 drop-shadow-md">
              ... your resume was not selected for the next round.
            </p>
            <p className="text-lg text-gray-100">
              Keep coding and try again! 💪
            </p>
          </div>
        </div>
      </div>
    );
  }

  const runTests = () => {
    if (!question || !code) return;

    setIsRunning(true);
    const results: any[] = [];

    try {
      // Create a function from the user's code
      const userFunction = new Function('return ' + code)();
      
      question.testCases.forEach((testCase: any, index: number) => {
        try {
          const result = userFunction(...testCase.input);
          const passed = JSON.stringify(result) === JSON.stringify(testCase.expected);
          
          results.push({
            index: index + 1,
            input: testCase.input,
            expected: testCase.expected,
            actual: result,
            passed,
          });
        } catch (error) {
          results.push({
            index: index + 1,
            input: testCase.input,
            expected: testCase.expected,
            actual: `Error: ${error}`,
            passed: false,
          });
        }
      });

      setTestResults(results);
      
      const passedCount = results.filter(r => r.passed).length;
      
      // Submit to backend
      submitCode({
        playerId,
        code,
        testsPassed: passedCount,
      });

    } catch (error) {
      console.error("Code execution error:", error);
      setTestResults([{
        index: 1,
        input: "Code Error",
        expected: "Valid JavaScript",
        actual: `Syntax Error: ${error}`,
        passed: false,
      }]);
    }

    setIsRunning(false);
  };

  // Early return if player has won - only show celebration
  if (isWinner) {
    return (
      <div>
        {/* Blur backdrop */}
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        
        {/* Confetti particles */}
        {confetti.map((particle) => (
          <div
            key={particle.id}
            className="fixed pointer-events-none"
            style={{
              left: `${particle.left}%`,
              top: "-20px",
              width: "10px",
              height: "10px",
              backgroundColor: particle.color,
              borderRadius: "50%",
              animation: `fall ${particle.duration}s linear ${particle.delay}s forwards`,
              zIndex: 51,
            }}
          />
        ))}
        
        {/* Winner celebration message */}
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 border-2 border-yellow-400 rounded-2xl p-8 text-center max-w-2xl shadow-2xl animate-bounce">
            <div className="mb-2 text-sm text-yellow-300 font-semibold">Interview Battle Royale</div>
            <div className="mb-4 text-6xl animate-pulse">👑</div>
            <h2 className="text-5xl font-bold text-yellow-300 mb-4 drop-shadow-lg animate-pulse">
              YOU GOT THE INTERNSHIP!
            </h2>
            <p className="text-xl text-yellow-200 mb-2 drop-shadow-md">
              🎉 Welcome to family! 🎉
            </p>
            <p className="text-lg text-gray-100">
              You defeated all opponents and passed <span className="text-yellow-300 font-bold text-xl">{currentPlayer.roundsWon || 0}</span> rounds of interviews!</p>
            <div className="mt-6 text-4xl">🏆 ⭐ 🏆</div>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading challenge...</p>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const passedTests = testResults.filter(r => r.passed).length;
  const totalTests = question.testCases.length;

  const getTimeColor = () => {
    if (timeRemaining <= 30) return "text-red-400";
    if (timeRemaining <= 60) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Red border attack effect */}
      {isAttacked && (
        <div 
          className="fixed inset-0 pointer-events-none animate-pulse"
          style={{
            boxShadow: 'inset 0 0 40px rgba(239, 68, 68, 0.6), inset 0 0 80px rgba(220, 38, 38, 0.4)',
            zIndex: 40,
            border: '2px solid rgb(239, 68, 68)',
          }}
        />
      )}

      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">{question.title}</h1>
            <div className="flex items-center gap-4">
              <span className="inline-block bg-green-600 text-white px-2 py-1 rounded text-sm">
                {question.difficulty}
              </span>
              <span className="text-gray-400">
                Players Remaining: {roomState.players.filter((p: any) => p.status !== "eliminated").length}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold transition-all duration-300 ${getTimeColor()} ${
              isAttacked ? 'animate-pulse scale-125 text-red-500' : ''
            }`}>
              ⏰ {formatTime(timeRemaining)}
            </div>
            <div className="text-sm text-gray-400">
              Tests: {passedTests}/{totalTests}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Problem Description */}
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-yellow-400 mb-4">📝 Problem</h2>
            <p className="text-gray-300 leading-relaxed">{question.description}</p>
          </div>

          {/* Test Cases */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-yellow-400 mb-4">🧪 Test Cases</h2>
            <div className="space-y-3">
              {question.testCases.map((testCase: any, index: number) => (
                <div key={index} className="bg-gray-700 rounded p-3">
                  <div className="text-sm text-gray-400">Test {index + 1}:</div>
                  <div className="font-mono text-sm">
                    <div>Input: {JSON.stringify(testCase.input)}</div>
                    <div>Expected: {JSON.stringify(testCase.expected)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard with Attack Buttons */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-yellow-400 mb-4">🏆 Live Rankings</h2>
            <div className="space-y-2">
              {roomState.players
                .filter((p: any) => p.status !== "eliminated")
                .sort((a: any, b: any) => {
                  if (a.status === "winner" && b.status !== "winner") return -1;
                  if (b.status === "winner" && a.status !== "winner") return 1;
                  if (a.status === "completed" && b.status !== "completed") return -1;
                  if (b.status === "completed" && a.status !== "completed") return 1;
                  return (b.roundsWon || 0) - (a.roundsWon || 0);
                })
                .map((player: any, index: number) => (
                  <div
                    key={player._id}
                    className={`flex justify-between items-center p-3 rounded ${
                      player._id === playerId ? "bg-yellow-900/50 border border-yellow-500" : "bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-yellow-400">#{index + 1}</span>
                      <span>{player.name}</span>
                      {player._id === playerId && <span className="text-yellow-400">(You)</span>}
                      <span className="text-sm text-gray-400">
                        ({player.roundsWon || 0} challenges)
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        {player.status === "winner" ? (
                          <span className="text-purple-400 font-bold">👑 CHAMPION</span>
                        ) : player.status === "completed" ? (
                          <span className="text-green-400 font-bold">✅ SOLVED</span>
                        ) : player.status === "eliminated" ? (
                          <span className="text-red-400 font-bold">💀 ELIMINATED</span>
                        ) : (
                          <div>
                            <div className="text-gray-400">
                              {player.testsPassed || 0}/{totalTests} tests
                            </div>
                            <div className={`text-sm ${
                              (player.timeRemaining || 0) <= 30 ? 'text-red-400' : 
                              (player.timeRemaining || 0) <= 60 ? 'text-yellow-400' : 'text-green-400'
                            }`}>
                              ⏰ {formatTime(player.timeRemaining || 0)}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Attack button removed - attacks now happen automatically */}
                    </div>
                  </div>
                ))}
            </div>
            {/* Attack info removed - attacks now happen automatically on completion */}
          </div>
        </div>

        {/* Code Editor */}
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-yellow-400">💻 Code Editor</h2>
              <button
                onClick={runTests}
                disabled={isRunning || !code.trim() || currentPlayer?.status === "eliminated"}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded font-semibold transition-colors"
              >
                {isRunning ? "Running..." : "Run Tests 🚀"}
              </button>
            </div>
            <CodeEditor code={code} onChange={setCode} />
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-yellow-400 mb-4">
                📊 Results ({passedTests}/{totalTests} passed)
              </h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {testResults.map((result) => (
                  <div
                    key={result.index}
                    className={`p-3 rounded border-l-4 ${
                      result.passed
                        ? "bg-green-900/30 border-green-500"
                        : "bg-red-900/30 border-red-500"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">Test {result.index}</span>
                      <span className={result.passed ? "text-green-400" : "text-red-400"}>
                        {result.passed ? "✅ PASS" : "❌ FAIL"}
                      </span>
                    </div>
                    <div className="text-sm font-mono space-y-1">
                      <div>Input: {JSON.stringify(result.input)}</div>
                      <div>Expected: {JSON.stringify(result.expected)}</div>
                      <div>Got: {JSON.stringify(result.actual)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Messages */}
          {currentPlayer?.status === "completed" && (
            <div className="bg-green-900/50 border border-green-500 rounded-lg p-6 text-center">
              <h2 className="text-2xl font-bold text-green-400 mb-2">🎉 PROBLEM SOLVED!</h2>
              <p className="text-gray-300">
                Problems Solved: {currentPlayer.roundsWon || 0}. Next challenge incoming...
              </p>
            </div>
          )}

          {currentPlayer?.status === "eliminated" && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 text-center">
              <h2 className="text-2xl font-bold text-red-400 mb-2">💀 ELIMINATED!</h2>
              <p className="text-gray-300">
                Time ran out! Better luck next time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
