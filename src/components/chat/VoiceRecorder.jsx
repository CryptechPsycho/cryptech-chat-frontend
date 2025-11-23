// frontend/src/components/chat/VoiceRecorder.jsx
import React, { useEffect, useRef, useState } from "react";
import { useCall } from "../call/CallContext";

const DEFAULT_MAX_WORDS = 300;
const WAVEFORM_BARS = 24;
const MAX_RECORD_SECONDS = 60;

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const VoiceRecorder = ({
  maxWords = DEFAULT_MAX_WORDS,
  onSendText,
  onSendVoice,
}) => {
  const { callState } = useCall(); // NEW

  // "text" | "recording" | "preview"
  const [mode, setMode] = useState("text");

  const [text, setText] = useState("");
  const [error, setError] = useState("");

  // recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // preview
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewDuration, setPreviewDuration] = useState(0);

  // waveform
  const [waveform, setWaveform] = useState(
    Array.from({ length: WAVEFORM_BARS }, () => 0.2)
  );
  const [previewWaveform, setPreviewWaveform] = useState(
    Array.from({ length: WAVEFORM_BARS }, () => 0.2)
  );
  const latestWaveformRef = useRef(waveform);

  // recording infra
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordIntervalRef = useRef(null);
  const recordSecondsRef = useRef(0);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);

  // keep latest waveform
  useEffect(() => {
    latestWaveformRef.current = waveform;
  }, [waveform]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecordingInternal(true);
    };
  }, []);

  const countWords = (str) =>
    str.trim().length === 0
      ? 0
      : str.trim().split(/\s+/).filter(Boolean).length;

  // ============================
  // TEXT SEND
  // ============================
  const handleSubmitText = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    if (countWords(trimmed) > maxWords) {
      setError(`Max ${maxWords} words.`);
      return;
    }

    if (onSendText) onSendText(trimmed);
    setText("");
    setError("");
  };

  // ============================
  // RECORDING
  // ============================
  const startWaveformLoop = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      const step = Math.max(1, Math.floor(dataArray.length / WAVEFORM_BARS));
      const bars = [];
      for (let i = 0; i < WAVEFORM_BARS; i++) {
        const v = dataArray[i * step] || 0;
        bars.push(v / 255);
      }
      setWaveform(bars);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const stopWaveformLoop = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  const startRecording = async () => {
    if (isRecording) return;

    setError("");
    setPreviewBlob(null);
    setPreviewDuration(0);
    setPreviewWaveform(Array.from({ length: WAVEFORM_BARS }, () => 0.2));

    if (callState === "in-call") {
      alert("You cannot record or send voice messages while in a call.");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      let options = { mimeType: "audio/webm;codecs=opus" };
      if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "audio/webm" };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      chunksRef.current = [];
      recordSecondsRef.current = 0;
      setRecordSeconds(0);
      setIsRecording(true);
      setMode("recording");

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];

        const duration = recordSecondsRef.current;

        if (duration >= 1 && blob.size > 0) {
          setPreviewBlob(blob);
          setPreviewDuration(duration);
          setPreviewWaveform(latestWaveformRef.current);
          setMode("preview");
        } else {
          setMode("text");
        }

        setIsRecording(false);
        setRecordSeconds(0);
      };

      mediaRecorder.start();

      // 60s cap
      recordIntervalRef.current = setInterval(() => {
        recordSecondsRef.current += 1;
        setRecordSeconds(recordSecondsRef.current);

        if (recordSecondsRef.current >= MAX_RECORD_SECONDS) {
          stopRecordingInternal(false);
        }
      }, 1000);

      startWaveformLoop();
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Microphone permission denied or unavailable.");
      stopRecordingInternal(true);
    }
  };

  const stopRecordingInternal = (force = false) => {
    try {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }

      stopWaveformLoop();

      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== "inactive" && !force) {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      dataArrayRef.current = null;

      if (force) {
        setIsRecording(false);
        setRecordSeconds(0);
        setMode("text");
      }
    } catch (err) {
      console.error("Error stopping recording:", err);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    stopRecordingInternal(false);
  };

  const handleToggleRecording = () => {
    if (callState === "in-call") {
      alert("You cannot record or send voice messages while in a call.");
      return;
    }

    if (mode === "text") startRecording();
    else if (mode === "recording") stopRecording();
  };

  // ============================
  // PREVIEW & SEND
  // ============================
  const handleDiscardVoice = () => {
    setPreviewBlob(null);
    setPreviewDuration(0);
    setPreviewWaveform(Array.from({ length: WAVEFORM_BARS }, () => 0.2));
    setMode("text");
  };

  const handleSendVoiceClick = () => {
    if (!previewBlob || !onSendVoice) {
      handleDiscardVoice();
      return;
    }

    onSendVoice({
      blob: previewBlob,
      duration: previewDuration,
      waveform: previewWaveform,
    });

    handleDiscardVoice();
  };

  // waveform bars
  const WaveformBars = ({ values }) => (
    <div className="flex items-end gap-[2px] h-6">
      {values.map((v, idx) => (
        <span
          key={idx}
          className="w-[3px] rounded-full bg-white/80"
          style={{
            height: `${4 + v * 20}px`,
            opacity: 0.4 + v * 0.6,
          }}
        />
      ))}
    </div>
  );

  // ============================
  // RENDER
  // ============================
  return (
    <div className="flex flex-col gap-1">

      {/* TEXT MODE */}
      {mode === "text" && (
        <form onSubmit={handleSubmitText} className="flex gap-2 items-center">
          {text.length === 0 ? (
            <button
              type="button"
              onClick={handleToggleRecording}
              disabled={callState === "in-call"}
              className={`flex items-center justify-center w-10 h-10 rounded-full border text-lg ${
                callState === "in-call"
                  ? "border-gray-600 bg-gray-700 cursor-not-allowed opacity-40"
                  : "border-white/20 bg-white/5 hover:bg-white/10"
              }`}
              aria-label="Record voice message"
            >
              🎤
            </button>
          ) : (
            <div className="w-10" />
          )}

          <input
            className="input text-sm flex-1"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => {
              const value = e.target.value;
              setText(value);
              const words = countWords(value);
              if (words > maxWords) setError(`Max ${maxWords} words.`);
              else setError("");
            }}
          />

          <button type="submit" className="btn-primary px-5">
            Send
          </button>
        </form>
      )}

      {/* RECORDING MODE */}
      {mode === "recording" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
          <button
            type="button"
            onClick={handleToggleRecording}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white text-xs font-semibold"
          >
            Stop
          </button>

          <div className="flex-1 flex items-center justify-between gap-3">
            <WaveformBars values={waveform} />
            <span className="text-[11px] text-red-400 font-medium">
              ● {formatDuration(recordSeconds)}
              {recordSeconds >= MAX_RECORD_SECONDS ? " (max)" : ""}
            </span>
          </div>
        </div>
      )}

      {/* PREVIEW MODE */}
      {mode === "preview" && (
        <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 flex flex-col gap-2">
          <audio
            controls
            autoPlay
            src={previewBlob ? URL.createObjectURL(previewBlob) : ""}
            className="w-full h-7"
            style={{ minHeight: "28px" }}
          />

          <div className="flex items-center justify-between">
            <WaveformBars values={previewWaveform} />
            <span className="text-[10px] text-gray-300">
              {formatDuration(previewDuration)}
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary px-3 py-1 text-xs"
              onClick={handleDiscardVoice}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn-primary px-3 py-1 text-xs"
              onClick={handleSendVoiceClick}
            >
              Send voice
            </button>
          </div>
        </div>
      )}

      {/* ERRORS */}
      {error && <p className="text-[11px] text-red-400 mt-0.5">{error}</p>}
    </div>
  );
};

export default VoiceRecorder;
