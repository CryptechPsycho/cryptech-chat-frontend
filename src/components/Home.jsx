import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../App";

const Home = () => {
  const { username, setUsername } = useContext(UserContext);
  const [localName, setLocalName] = useState(username || "");
  const [error, setError] = useState("");   // <-- NEW
  const navigate = useNavigate();

  const handleContinue = (path) => {
    if (!localName.trim()) {
      setError("Please enter a display name.");   // <-- show red error
      return;
    }

    setError("");
    setUsername(localName.trim());
    navigate(path);
  };

  return (
    <div className="glass-card p-6 md:p-8 space-y-6 w-full">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Welcome to Cryptech Rooms</h2>
        <p className="text-sm text-gray-400">
          Set your display name and either create a new private room or join your friend with a code.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-semibold text-gray-300 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <span className="text-lg">👤</span>
          </span>
          DISPLAY NAME
        </label>

        <input
          className="input"
          placeholder="e.g. CryptechNiraj"
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            if (error) setError("");  // clear on typing
          }}
        />

        {/* 🔥 RED ERROR TEXT */}
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3 pt-2">
        <button
          className="btn-primary w-full"
          onClick={() => handleContinue("/join")}
        >
          JOIN ROOM
        </button>
        <button
          className="btn-secondary w-full"
          onClick={() => handleContinue("/create")}
        >
          CREATE ROOM
        </button>
      </div>

      <p className="text-[11px] text-gray-500 pt-1">
        Rooms are temporary and peer-to-peer. Share your code only with people you trust.
      </p>
    </div>
  );
};

export default Home;
