import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { GameLobby } from "./components/GameLobby";
import { useState } from "react";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      <header className="sticky top-0 z-10 bg-gray-800/80 backdrop-blur-sm h-16 flex justify-between items-center border-b border-gray-700 shadow-sm px-4">
        <h2 className="text-xl font-bold text-yellow-400">⚔️ LeetCode Battle Royale</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-6xl mx-auto">
          <Content />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [gameStarted, setGameStarted] = useState(false);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (gameStarted) {
    return <GameLobby />;
  }

  return (
    <div className="flex flex-col gap-8 text-center">
      <div>
        <h1 className="text-6xl font-bold text-yellow-400 mb-4">⚔️ Battle Royale</h1>
        <p className="text-2xl text-gray-300 mb-2">Compete in real-time coding challenges!</p>
        <p className="text-lg text-gray-400">
          Join a room, wait for other players, and solve LeetCode problems faster than everyone else!
        </p>
      </div>

      <Authenticated>
        <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-yellow-400">Ready to Battle?</h2>
          <p className="text-gray-300 mb-6">
            Welcome back, {loggedInUser?.email ?? "Coder"}!
          </p>
          <button
            onClick={() => setGameStarted(true)}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Join Battle 🚀
          </button>
        </div>
      </Authenticated>

      <Unauthenticated>
        <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-yellow-400">Sign in to Battle</h2>
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}
