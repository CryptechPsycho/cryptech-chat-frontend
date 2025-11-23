import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  BrowserRouter,
} from "react-router-dom";

import Home from "./components/Home";
import CreateRoom from "./components/CreateRoom";
import JoinRoom from "./components/JoinRoom";
import ChatRoom from "./components/ChatRoom";

// CALL SYSTEM CONTEXT
import { CallProvider } from "./components/call/CallContext";

export const UserContext = React.createContext();

const AppContent = () => {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const isRoom = location.pathname.startsWith("/room/");
  const [triggerLeaveModal, setTriggerLeaveModal] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("cryptech-username");
    if (stored) setUsername(stored);
  }, []);

  useEffect(() => {
    if (username) {
      localStorage.setItem("cryptech-username", username);
    }
  }, [username]);

  const handleLogoClick = () => {
    if (isRoom) {
      triggerLeaveModal?.();
    } else {
      navigate("/");
    }
  };

  return (
    <UserContext.Provider value={{ username, setUsername }}>
      <CallProvider>
        <div className="min-h-screen w-full relative overflow-hidden">

          {/* Background */}
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(76,111,255,0.35),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(34,211,238,0.3),transparent_55%)]" />
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(15,23,42,0.9),transparent_60%)]" />

          <main className="relative z-10 flex flex-col min-h-screen">

            {/* Header */}
            <header
              className="flex items-center justify-between px-6 md:px-12 py-4 cursor-pointer select-none"
              onClick={handleLogoClick}
            >
              <div className="flex items-center gap-3">
                <img
                  src="/cryptech-logo.png"
                  alt="Cryptech.ai logo"
                  className="w-10 h-10 rounded-xl shadow-lg shadow-cyan-500/40 bg-black/40 object-contain"
                />
                <div>
                  <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                    <span className="bg-gradient-to-r from-ct-accent to-ct-accent-soft bg-clip-text text-transparent">
                      Cryptech.ai
                    </span>
                  </h1>
                  <p className="text-[11px] text-gray-400 uppercase tracking-[0.2em]">
                    realtime rooms
                  </p>
                </div>
              </div>
            </header>

            {/* Routes */}
            <section className="flex-1 flex items-center justify-center px-4 pb-8">
              <div className="w-full max-w-5xl flex flex-col md:flex-row gap-8">

                <div className="md:w-2/3">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/create" element={<CreateRoom />} />
                    <Route path="/join" element={<JoinRoom />} />
                    <Route
                      path="/room/:roomCode"
                      element={
                        <ChatRoom setTriggerLeaveModal={setTriggerLeaveModal} />
                      }
                    />
                  </Routes>
                </div>

                {/* Robot */}
                <div className="hidden md:flex md:w-1/3 items-center justify-center">
                  <div className="relative">
                    <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-ct-accent/40 to-ct-accent-soft/40 blur-2xl opacity-70" />
                    <img
                      src="/robot-mascot.png"
                      alt="Cryptech robot"
                      className="relative w-56 drop-shadow-[0_25px_40px_rgba(0,0,0,0.7)] animate-bounce-slow"
                    />
                  </div>
                </div>

              </div>
            </section>
          </main>
        </div>
      </CallProvider>
    </UserContext.Provider>
  );
};

const App = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;
