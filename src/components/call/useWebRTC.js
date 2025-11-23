// frontend/src/components/call/useWebRTC.js
import { useEffect, useRef, useState } from "react";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
];

export default function useWebRTC({ socket, roomCode }) {
  // multiple remote streams (one per remote peer)
  const [remoteStreams, setRemoteStreams] = useState([]);

  // local mic stream
  const localStreamRef = useRef(null);

  // remoteId -> RTCPeerConnection
  const peersRef = useRef(new Map());

  // -----------------------------
  // helpers
  // -----------------------------
  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  };

  const closeAllPeers = () => {
    for (const pc of peersRef.current.values()) {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.close();
      } catch (err) {
        console.error("Error closing peer", err);
      }
    }
    peersRef.current.clear();
    setRemoteStreams([]);
  };

  const cleanup = () => {
    closeAllPeers();
    stopLocalStream();
  };

  const ensureLocalStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    localStreamRef.current = stream;
    return stream;
  };

  const createPeerConnection = async (remoteSocketId) => {
    // reuse if already exists
    if (peersRef.current.has(remoteSocketId)) {
      return peersRef.current.get(remoteSocketId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const localStream = await ensureLocalStream();
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("call-ice-candidate", {
          roomCode,
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;

      setRemoteStreams((prev) => {
        const exists = prev.find((s) => s.id === remoteStream.id);
        if (exists) return prev;
        return [...prev, remoteStream];
      });
    };

    peersRef.current.set(remoteSocketId, pc);
    return pc;
  };

  // -----------------------------
  // API: start call towards ONE peer
  // called by the *joiner* to connect to each existing participant
  // -----------------------------
  const startCallTo = async (remoteSocketId) => {
    if (!socket) return;
    try {
      const pc = await createPeerConnection(remoteSocketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call-offer", {
        roomCode,
        to: remoteSocketId,
        sdp: offer,
      });
    } catch (err) {
      console.error("startCallTo error:", err);
    }
  };

  // -----------------------------
  // Mute/unmute local audio
  // -----------------------------
  const muteLocalAudio = (muted) => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  };

  // -----------------------------
  // Signaling handlers
  // -----------------------------
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ roomCode: callRoom, from, sdp }) => {
      if (callRoom !== roomCode) return;

      try {
        const pc = await createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("call-answer", {
          roomCode,
          to: from,
          sdp: answer,
        });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    };

    const handleAnswer = async ({ roomCode: callRoom, from, sdp }) => {
      if (callRoom !== roomCode) return;
      const pc = peersRef.current.get(from);
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    };

    const handleIceCandidate = async ({
      roomCode: callRoom,
      from,
      candidate,
    }) => {
      if (callRoom !== roomCode) return;
      const pc = peersRef.current.get(from);
      if (!pc || !candidate) return;

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate", err);
      }
    };

    socket.on("call-offer", handleOffer);
    socket.on("call-answer", handleAnswer);
    socket.on("call-ice-candidate", handleIceCandidate);

    return () => {
      socket.off("call-offer", handleOffer);
      socket.off("call-answer", handleAnswer);
      socket.off("call-ice-candidate", handleIceCandidate);
    };
  }, [socket, roomCode]);

  return {
    remoteStreams,
    startCallTo,     // new: joiner uses this for each peer
    muteLocalAudio,
    cleanup,
  };
}
