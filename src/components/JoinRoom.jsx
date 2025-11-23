// JoinRoom.jsx
import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../App";
import { io } from "socket.io-client";

const JoinRoom = () => {
  const { username } = useContext(UserContext);
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    setError("");

    if (roomCode.length !== 5) {
      setError("Please enter a 5-letter room code.");
      return;
    }

    const socket = io("https://cryptech-chat-backend.onrender.com", { transports: ["websocket"] });

    // Ask backend if room exists
    socket.emit("join-room", { roomCode, username: "checking-if-exists" }, (res) => {
      socket.disconnect();

      if (!res.success && res.error === "invalid-room") {
        return setError("Room does not exist.");
      }

      if (res.error === "username-taken") {
        return setError("A user in this room already has your name.");
      }

      // VALID → go to room
      navigate(`/room/${roomCode}`);
    });
  };

  return (
    <div className="pt-20 glass-card p-6 md:p-8 space-y-6 w-full">
      <h2 className="text-xl font-semibold">Join a Cryptech room</h2>

      <form onSubmit={handleJoin} className="space-y-4">
        <label className="text-xs text-gray-300">
          ROOM CODE
          <input
            className="input mt-2 uppercase tracking-[0.3em] text-center"
            value={roomCode}
            maxLength={5}
            onChange={(e) => {
              setRoomCode(e.target.value.toUpperCase());
              setError("");
            }}
            placeholder="ABCDE"
          />
        </label>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button className="btn-primary w-full">
          JOIN ROOM{username ? ` as ${username}` : ""}
        </button>
      </form>

      <p className="text-[11px] text-gray-500">
        If the code is wrong or the room doesn't exist, an error will show here.
      </p>
    </div>
  );
};

export default JoinRoom;
