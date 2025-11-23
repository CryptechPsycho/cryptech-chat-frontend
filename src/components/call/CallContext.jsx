// frontend/src/components/call/CallContext.jsx
import React, { createContext, useContext, useState } from "react";

const CallContext = createContext();
export const useCall = () => useContext(CallContext);

/**
 * callState:
 *  - "idle"     = no call going on
 *  - "calling"  = you started a call (ringing others)
 *  - "ringing"  = there is an active call in this room you can join
 *  - "in-call"  = you are in an active call
 *  - "ended"    = call just ended (short fade-out)
 *
 * participants is an array of:
 *   { id: "<socketId>", name: "<username>" }
 */

export const CallProvider = ({ children }) => {
  const [callState, setCallState] = useState("idle");
  const [callRoom, setCallRoom] = useState(null);
  const [callHost, setCallHost] = useState(null); // host username (for label)
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);

  // add participant by socketId (unique) + name
  const addParticipant = (id, username) => {
    setParticipants((prev) => {
      if (prev.some((p) => p.id === id)) return prev;
      return [...prev, { id, name: username }];
    });
  };

  // remove by socketId
  const removeParticipant = (id) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const resetCall = () => {
    setCallState("idle");
    setCallRoom(null);
    setCallHost(null);
    setParticipants([]);
    setIsMuted(false);
  };

  // local “I’m joining this call” helper
  const joinCall = (roomCode, socketId, username) => {
    setCallRoom(roomCode);
    addParticipant(socketId, username);
    setCallState("in-call");
  };

  // used when the server tells us the call is fully done
  const markEnded = () => {
    setCallState("ended");
    setTimeout(() => {
      resetCall();
    }, 800);
  };

  const toggleMute = () => setIsMuted((prev) => !prev);

  return (
    <CallContext.Provider
      value={{
        callState,
        callRoom,
        callHost,
        participants,
        isMuted,
        // actions
        setCallState,
        setCallRoom,
        setCallHost,
        setParticipants,
        addParticipant,
        removeParticipant,
        joinCall,
        toggleMute,
        resetCall,
        markEnded,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
