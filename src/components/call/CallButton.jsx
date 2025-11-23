// frontend/src/components/call/CallButton.jsx
import React from "react";
import { useCall } from "./CallContext";

const CallButton = ({ socket, roomCode, username }) => {
  const { callState, setCallState, setCallHost, setCallRoom, joinCall } =
    useCall();

  const handleClick = () => {
    if (!socket) return;

    if (callState === "idle" || callState === "ended") {
      // Start a new call
      setCallHost(username);
      setCallRoom(roomCode);
      setCallState("calling");

      socket.emit("call-start", {
        roomCode,
        username,
        socketId: socket.id,
      });
    } else if (callState === "ringing") {
      // Call already exists → join instead of starting another one
      joinCall(roomCode, socket.id, username);
      socket.emit("call-accept", {
        roomCode,
        username,
        socketId: socket.id,
      });
    }
    // calling / in-call → do nothing (button is disabled)
  };

  const label =
    callState === "in-call"
      ? "In call"
      : callState === "calling"
      ? "Calling…"
      : callState === "ringing"
      ? "Join call"
      : "Call";

  // Only disabled when you're already calling or in a call.
  const disabled = callState === "calling" || callState === "in-call";

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-full border text-xs ${
        callState === "in-call"
          ? "bg-emerald-600/30 border-emerald-400/70 text-emerald-200"
          : "bg-cyan-500/20 border-cyan-400/60 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-60 disabled:cursor-default"
      }`}
    >
      📞 {label}
    </button>
  );
};

export default CallButton;
