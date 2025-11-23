// CreateRoom.jsx
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { UserContext } from "../App";

let socket;

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const CreateRoom = () => {
  const { username } = useContext(UserContext);
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    // Generate + store room code
    const code = generateRoomCode();
    setRoomCode(code);

    // Connect socket
    socket = io("http://localhost:5000", {
      transports: ["websocket"],
    });

    // Create this room in backend
    socket.emit("create-room", { roomCode: code });
  }, [username, navigate]);

  const handleEnterRoom = () => {
    navigate(`/room/${roomCode}`);
  };

  return (
    <div className="pt-20 glass-card p-6 md:p-8 space-y-6 w-full">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Room created for {username}</h2>
        <p className="text-sm text-gray-400">
          Share this code with your friend so they can join your private room.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
          ROOM CODE
        </p>
        <div className="px-5 py-3 rounded-2xl bg-black/40 border border-white/10 font-mono text-2xl tracking-[0.45em]">
          {roomCode}
        </div>
      </div>

      <button className="btn-primary w-full" onClick={handleEnterRoom}>
        ENTER CHAT
      </button>
    </div>
  );
};

export default CreateRoom;
