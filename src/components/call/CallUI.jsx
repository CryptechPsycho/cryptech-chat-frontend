// frontend/src/components/call/CallUI.jsx
import React, { useEffect, useState } from "react";
import { useCall } from "./CallContext";
import useWebRTC from "./useWebRTC";

const CallUI = ({ socket, roomCode, username }) => {
  const {
    callState,
    callHost,
    participants,
    isMuted,
    setCallState,
    setCallHost,
    setCallRoom,
    addParticipant,
    removeParticipant,
    joinCall,
    toggleMute,
    markEnded,
  } = useCall();

  const [elapsed, setElapsed] = useState(0);

  const { remoteStreams, startCallTo, muteLocalAudio, cleanup } =
    useWebRTC({ socket, roomCode });

  // Timer while in call
  useEffect(() => {
    let timer;
    if (callState === "in-call") {
      setElapsed(0);
      timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(timer);
  }, [callState]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    // When someone starts a call in this room
    const handleIncomingCall = ({
      caller,
      callerId,
      roomCode: callRoomCode,
      participants: serverParticipants = [], // [{id, username}]
    }) => {
      if (callRoomCode !== roomCode) return;

      setCallHost(caller);
      setCallRoom(callRoomCode);

      serverParticipants.forEach((p) => addParticipant(p.id, p.username));

      const iAmCaller = callerId === socket.id;

      if (iAmCaller) {
        setCallState("calling");
      } else {
        if (callState !== "in-call") {
          setCallState("ringing");
        }
      }
    };

    // When YOU join the room and a call already exists
    const handleExistingCall = ({
      roomCode: callRoomCode,
      hostName,
      participants: serverParticipants = [], // [{id, username}]
    }) => {
      if (callRoomCode !== roomCode) return;

      setCallHost(hostName || null);
      setCallRoom(callRoomCode);

      serverParticipants.forEach((p) => addParticipant(p.id, p.username));

      const alreadyInCall = serverParticipants.some(
        (p) => p.id === socket.id
      );

      if (alreadyInCall) {
        setCallState("in-call");
      } else if (callState !== "in-call") {
        setCallState("ringing");
      }
    };

    // Somebody accepted the call
    const handleUserJoined = ({
      socketId,
      username: joinedUser,
      participants: serverParticipants = [], // [{id, username}]
    }) => {
      // add the newly joined user locally
      addParticipant(socketId, joinedUser);
      setCallState("in-call");

      // If *I* am the new joiner, start WebRTC offers toward everyone else
      if (socketId === socket.id) {
        serverParticipants
          .filter((p) => p.id !== socket.id)
          .forEach((p) => {
            startCallTo(p.id).catch((err) =>
              console.error("startCallTo error", err)
            );
          });
      }
      // If I'm an existing participant, I just wait for offers
    };

    // Somebody left the call
    const handleUserLeft = ({ socketId, username: leftUser, roomEmpty }) => {
      if (!socketId) return;

      removeParticipant(socketId);

      if (roomEmpty) {
        markEnded();
        setCallHost(null);
        setCallRoom(null);
        cleanup();
        return;
      }

      // If *you* left but others are still in, show "join" again
      if (socketId === socket.id) {
        cleanup();
        setCallState("ringing");
      }
    };

    const handleUserDeclined = ({ username: declinedUser }) => {
      console.log(`${declinedUser} declined the call`);
    };

    const handleCallEnded = () => {
      markEnded();
      setCallHost(null);
      setCallRoom(null);
      cleanup();
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-existing", handleExistingCall);
    socket.on("call-user-joined", handleUserJoined);
    socket.on("call-user-left", handleUserLeft);
    socket.on("call-user-declined", handleUserDeclined);
    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-existing", handleExistingCall);
      socket.off("call-user-joined", handleUserJoined);
      socket.off("call-user-left", handleUserLeft);
      socket.off("call-user-declined", handleUserDeclined);
      socket.off("call-ended", handleCallEnded);
    };
  }, [
    socket,
    roomCode,
    callState,
    addParticipant,
    removeParticipant,
    setCallState,
    setCallHost,
    setCallRoom,
    markEnded,
    startCallTo,
    cleanup,
  ]);

  if (callState === "idle") return null;

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleJoin = () => {
    if (!socket) return;
    // local state
    joinCall(roomCode, socket.id, username);
    // server state
    socket.emit("call-accept", { roomCode, username });
  };

  const handleLeave = () => {
    if (!socket) return;
    socket.emit("call-leave", { roomCode });
  };

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    toggleMute();
    muteLocalAudio(newMuted);
    if (socket) {
      socket.emit("call-mute", { roomCode, muted: newMuted });
    }
  };

  const isHost = callHost === username;
  const hostAlone = isHost && participants.length <= 1;

  return (
    <>
      <div className="mt-2 mb-1 w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-2 flex items-center justify-between gap-4">
        {/* LEFT: Status + participants */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex flex-col">
            {callState === "calling" && (
              <>
                <span className="text-xs text-cyan-300 font-semibold">
                  Calling everyone in this room…
                </span>
                {callHost && (
                  <span className="text-[10px] text-gray-400">
                    Host: <span className="font-medium">{callHost}</span>
                  </span>
                )}
              </>
            )}

            {callState === "ringing" && (
              <>
                <span className="text-xs text-cyan-300 font-semibold">
                  {callHost || "Someone"} is in a call…
                </span>
                <span className="text-[10px] text-gray-400">
                  Tap Join to enter the call.
                </span>
              </>
            )}

            {callState === "in-call" && (
              <>
                <span className="text-xs text-emerald-300 font-semibold">
                  In call — {formatTime(elapsed)}
                </span>
                <span className="text-[10px] text-gray-400">
                  Room <span className="font-mono">{roomCode}</span>
                </span>
              </>
            )}

            {callState === "ended" && (
              <span className="text-xs text-gray-300 font-semibold">
                Call ended
              </span>
            )}
          </div>

          {/* Avatars */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-[220px]">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/15"
              >
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px]">
                  {p.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-[10px] text-gray-200 max-w-[80px] truncate">
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {callState === "ringing" && (
            <button
              className="px-3 py-1 rounded-full bg-emerald-500/70 text-xs text-white hover:bg-emerald-500"
              onClick={handleJoin}
            >
              Join
            </button>
          )}

          {callState === "calling" && (
            <button
              className="px-3 py-1 rounded-full bg-red-600/70 text-xs text-white hover:bg-red-600"
              onClick={handleLeave}
            >
              Cancel
            </button>
          )}

          {callState === "in-call" && (
            <>
              <button
                onClick={handleToggleMute}
                className={`px-3 py-1 rounded-full text-[11px] ${
                  isMuted
                    ? "bg-yellow-600/50 text-yellow-100 border border-yellow-400/70"
                    : "bg-white/10 text-white border border-white/25"
                }`}
              >
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button
                onClick={handleLeave}
                className="px-3 py-1 rounded-full bg-red-600/80 text-red-50 border border-red-500/80 text-[11px]"
              >
                {hostAlone ? "End call" : "Leave"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hidden audio tags for remote streams */}
      <div className="hidden">
        {remoteStreams.map((stream, i) => (
          <audio
            key={stream.id || i}
            autoPlay
            playsInline
            ref={(el) => {
              if (el && stream && el.srcObject !== stream) {
                el.srcObject = stream;
              }
            }}
          />
        ))}
      </div>
    </>
  );
};

export default CallUI;
