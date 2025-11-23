// frontend/src/components/ChatRoom.jsx
import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { UserContext } from "../App";
import VoiceRecorder from "./chat/VoiceRecorder";

// CALL SYSTEM
import CallButton from "./call/CallButton";
import CallUI from "./call/CallUI";
import { useCall } from "./call/CallContext";

let socket;
const MAX_WORDS = 300;

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const ChatRoom = ({ setTriggerLeaveModal }) => {
  const { roomCode } = useParams();
  const { username } = useContext(UserContext);
  const navigate = useNavigate();
  const { callState } = useCall(); // read call status

  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [mySocketId, setMySocketId] = useState(null);

  const messagesEndRef = useRef(null);

  // ============================
  // INIT SOCKET
  // ============================
  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    socket = io("https://cryptech-chat-backend.onrender.com", {
      transports: ["websocket"],
      upgrade: false,
    });

    socket.on("connect", () => {
      setMySocketId(socket.id);

      socket.emit("join-room", { roomCode, username }, (res) => {
        if (!res.success && res.error === "invalid-room") {
          navigate("/join?error=room-not-found");
        }
      });
    });

    socket.on("room-users", ({ users }) => setUsers(users));

    socket.on("system-message", (msg) =>
      setMessages((prev) => [...prev, { ...msg, type: "system" }])
    );

    // text messages
    socket.on("receive-message", (msg) =>
      setMessages((prev) => [...prev, { ...msg, type: "text" }])
    );

    // voice messages
    socket.on("receive-voice-message", (msg) => {
      try {
        let raw = msg.audio;

        // Node Buffer { data: [...] } or plain array
        if (raw?.data && Array.isArray(raw.data)) {
          raw = new Uint8Array(raw.data);
        } else if (Array.isArray(raw)) {
          raw = new Uint8Array(raw);
        }

        const blob = new Blob([raw], {
          type: msg.mimeType || "audio/webm",
        });
        const audioUrl = URL.createObjectURL(blob);

        setMessages((prev) => [
          ...prev,
          { ...msg, type: "audio", audioUrl },
        ]);
      } catch (err) {
        console.error("Failed to handle voice message:", err);
      }
    });

    if (setTriggerLeaveModal) {
      setTriggerLeaveModal(() => () => setShowLeaveModal(true));
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [roomCode, username, navigate, setTriggerLeaveModal]);

  // ============================
  // AUTO SCROLL
  // ============================
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ============================
  // SEND HANDLERS
  // ============================
  const handleSendText = (text) => {
    if (!socket) return;
    socket.emit("send-message", { roomCode, username, text });
  };

  const handleSendVoice = async ({ blob, duration }) => {
    if (!socket) return;

    // BLOCK sending voice messages during call
    if (callState === "in-call") {
      alert("You cannot send voice messages while in a call.");
      return;
    }

    const buffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    socket.emit("voice-message", {
      roomCode,
      username,
      audio: Array.from(uint8),
      mimeType: blob.type,
      duration,
    });
  };

  // ============================
  // LEAVE ROOM
  // ============================
  const handleConfirmLeave = () => {
    socket.emit("manual-leave", { roomCode, username });
    socket.isManualDisconnect = true;
    socket.disconnect();
    navigate("/");
  };

  return (
    <>
      <div className="glass-card w-full h-[calc(100vh-6rem)] p-6 grid grid-cols-[3fr,1fr] gap-6 overflow-hidden min-h-0">
        {/* LEFT CHAT PANEL */}
        <section className="flex flex-col h-full min-h-0">
          {/* HEADER */}
          <header className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <p className="text-[10px] tracking-[0.25em] text-gray-400">
                ROOM
              </p>
              <p className="font-semibold tracking-[0.35em]">{roomCode}</p>
            </div>

            <div className="flex items-center gap-4">
              {/* CALL BUTTON - pass socket */}
              <CallButton socket={socket} roomCode={roomCode} username={username} />

              <div className="text-right">
                <p className="text-[10px] text-gray-400 tracking-[0.2em]">
                  YOU
                </p>
                <p className="text-sm font-semibold">{username}</p>
              </div>

              <button
                className="text-xs px-3 py-2 rounded-full border border-red-400/70 text-red-300 hover:bg-red-500/10"
                onClick={() => setShowLeaveModal(true)}
              >
                Leave room
              </button>
            </div>
          </header>

          {/* CALL UI - call dock under header */}
          <CallUI socket={socket} roomCode={roomCode} username={username} />

          {/* MESSAGES */}
          <div className="flex-1 mt-3 mb-3 overflow-y-auto chat-scroll space-y-2 pr-2">
            {messages.map((msg, idx) => {
              if (msg.type === "system") {
                return (
                  <p
                    key={idx}
                    className="text-center text-[11px] text-gray-500 italic"
                  >
                    {msg.text}
                  </p>
                );
              }

              const isSelf = msg.senderId === mySocketId;
              const isAudio = msg.type === "audio";

              return (
                <div key={idx}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 text-sm break-words ${
                      isSelf
                        ? "ml-auto bg-gradient-to-r from-ct-accent to-ct-accent-soft"
                        : "mr-auto bg-white/5 border border-white/10"
                    } flex flex-col gap-1`}
                    style={{ paddingTop: 6, paddingBottom: 6 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold">
                        {isSelf ? "You" : msg.username}
                      </span>

                      <span className="text-[9px] text-gray-400">
                        {msg.timestamp
                          ? new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>

                    {isAudio ? (
                      <div className="flex items-center gap-3">
                        <audio
                          controls
                          src={msg.audioUrl}
                          className="h-9 w-56 rounded-lg"
                        />
                        <span className="text-[10px] text-gray-200">
                          {formatDuration(msg.duration)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[13px] leading-snug">{msg.text}</p>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div className="mt-auto pt-2 border-t border-white/10">
            <VoiceRecorder
              maxWords={MAX_WORDS}
              onSendText={handleSendText}
              onSendVoice={handleSendVoice}
            />
          </div>
        </section>

        {/* RIGHT USERS PANEL */}
        <aside className="h-full flex flex-col min-h-0">
          <h3 className="text-sm font-semibold mb-3 border-b border-white/10 pb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Online in this room
          </h3>

          <div className="space-y-2 overflow-y-auto chat-scroll pr-1">
            {users.map((u, idx) => (
              <div
                key={idx}
                className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-ct-accent to-ct-accent-soft flex items-center justify-center text-[10px] font-bold text-black">
                  {u.substring(0, 2).toUpperCase()}
                </div>

                <div>
                  <p className="text-xs font-medium">{u}</p>
                  <p className="text-[10px] text-emerald-400">online</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* LEAVE MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-30">
          <div className="glass-card p-6 max-w-sm space-y-4">
            <h2 className="text-lg font-semibold">Leave this room?</h2>

            <p className="text-sm text-gray-300">
              Are you sure you want to leave{" "}
              <span className="font-mono">{roomCode}</span>?
            </p>

            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary px-4 py-2 text-xs"
                onClick={() => setShowLeaveModal(false)}
              >
                Stay
              </button>

              <button
                className="btn-primary bg-red-600 px-4 py-2 text-xs text-white"
                onClick={handleConfirmLeave}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatRoom;
