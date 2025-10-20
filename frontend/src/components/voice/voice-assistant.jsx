// frontend/src/components/voice/voice-assistant.jsx
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDispatch } from "react-redux";
import { logoutUser } from "@/store/auth-slice";

const hasSpeech = () =>
  typeof window !== "undefined" &&
  ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

export default function VoiceAssistant() {
  const nav = useNavigate();
  const dispatch = useDispatch();

  const btnRef = useRef(null);
  const recRef = useRef(null);              // SR instance
  const restartTimerRef = useRef(null);     // debounce restarts
  const hideTimer = useRef(null);

  const [active, setActive] = useState(false); // user-pressed 1-shot listen
  const [wake, setWake] = useState(false);     // continuous wake-word mode
  const wakeRef = useRef(false);               // mirror of wake state (used inside handlers)

  const [heard, setHeard] = useState("");
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    wakeRef.current = wake;
  }, [wake]);

  // position bubble next to the mic button
  const updatePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBubblePos({
      top: r.bottom + 8,
      left: r.left,
      width: r.width,
    });
  };

  useEffect(() => {
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, []);

  // Create SR only once
  useEffect(() => {
    if (!hasSpeech()) return;
    if (recRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const transcript = (e.results?.[0]?.[0]?.transcript || "").trim();
      if (!transcript) return;
      setHeard(transcript);
      showBubbleTemporarily();
      handleCommand(transcript);
    };

    rec.onerror = (e) => {
      // common: "no-speech" or "not-allowed"
      // In wake mode, try to keep listening on harmless errors
      if (wakeRef.current && (e?.error === "no-speech" || e?.error === "aborted")) {
        safeRestart();
        return;
      }
      toast.error(e?.error || "Voice recognition error");
      setActive(false);
    };

    rec.onend = () => {
      // If wake mode is ON, silently restart without touching React state
      if (wakeRef.current) {
        safeRestart();
        return;
      }
      // One-shot mode ends: reflect idle state
      setActive(false);
    };

    recRef.current = rec;

    return () => {
      try { recRef.current?.stop(); } catch {}
      recRef.current = null;
    };
  }, []);

  // Start/stop when "active" changes, but DO NOT recreate SR
  useEffect(() => {
    const rec = recRef.current;
    if (!rec) return;

    if (active) {
      try {
        rec.start();
      } catch {
        // ignore possibly "start" while already started
      }
    } else {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
  }, [active]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(restartTimerRef.current);
      try { recRef.current?.stop(); } catch {}
    };
  }, []);

  const safeRestart = () => {
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      try {
        recRef.current?.start();
      } catch {
        // ignore
      }
    }, 250);
  };

  const showBubbleTemporarily = () => {
    updatePos();
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHeard(""), 2500);
  };

  const handleCommand = (raw) => {
    const phrase = raw.toLowerCase().trim();
    // allow "hey voice ..." prefix
    const cleaned = phrase.replace(/^hey\s+voice\s+/, "");
    const p = cleaned.length ? cleaned : phrase;

    const go = (path) => nav(path);
    const emit = (name, detail) =>
      window.dispatchEvent(new CustomEvent(name, { detail }));

    // navigation
    if (/(go|open)\s+home\b/.test(p)) return go("/shop/home");
    if (/(go|open|show)\s+(products|product list)/.test(p))
      return go("/shop/listing");
    if (/(open|show).*(cart|bag)/.test(p)) return emit("open-cart");
    if (/(open|show).*(account|profile)/.test(p)) return go("/shop/account");

    // browser basics
    if (/^back$/.test(p)) return window.history.back();
    if (/^forward$/.test(p)) return window.history.forward();
    if (/^refresh$|^reload$/.test(p)) return window.location.reload();

    // stop listening
    if (/stop (listening|voice)/.test(p)) {
      try { recRef.current?.stop(); } catch {}
      setActive(false);
      setWake(false);
      return;
    }

    // search
    const mSearch = p.match(/(?:search|find|look up)\s+(?:for\s+)?(.+)/);
    if (mSearch?.[1]) {
      const q = mSearch[1].trim();
      if (q) go(`/shop/search?q=${encodeURIComponent(q)}`);
      return;
    }

    // category
    const mCat = p.match(
      /(?:show|open)\s+(?:category\s+)?(men|women|kids|footwear|accessories)\b/
    );
    if (mCat?.[1]) {
      const cat = mCat[1];
      go(`/shop/listing?category=${encodeURIComponent(cat)}`);
      return;
    }

    // checkout entry
    if (/^(checkout|go to checkout|proceed to checkout)$/.test(p)) {
      go("/shop/checkout");
      emit("voice-checkout", { method: null });
      return;
    }

    // choose payment
    if (/(payhere|pay here|card|online payment)/.test(p)) {
      go("/shop/checkout");
      emit("voice-checkout", { method: "payhere" });
      toast.success("Payment method set to PayHere");
      return;
    }
    if (/(cash on delivery|cod|cash)/.test(p)) {
      go("/shop/checkout");
      emit("voice-checkout", { method: "cod" });
      toast.success("Payment method set to Cash on Delivery");
      return;
    }

    // place order
    if (/^(place order|confirm order|complete order|pay now)$/.test(p)) {
      emit("voice-place-order");
      toast.message("Placing order…");
      return;
    }

    // logout
    if (/^(logout|log out|sign out)$/.test(p)) {
      dispatch(logoutUser());
      toast.success("Logged out");
      go("/auth/login");
      return;
    }

    // add-to-cart heuristic: "add 2 black t shirt (to cart)" OR "add black t shirt"
    const mAdd = p.match(/^add(?:\s+(\d+))?\s+(.+?)(?:\s+to cart)?$/);
    if (mAdd) {
      const qty = Number(mAdd[1] || 1);
      const name = (mAdd[2] || "").trim();
      if (name) {
        emit("voice-add-to-cart", { name, qty: Math.max(1, qty) });
        toast.success(`Trying to add ${Math.max(1, qty)} × ${name}`);
        return;
      }
    }

    toast.info(`Heard: "${raw}"`);
  };

  const toggleListenOnce = () => {
    if (!hasSpeech()) {
      toast.error("Voice not supported on this browser");
      return;
    }
    // one-shot: turn off wake if it was on
    if (wake) setWake(false);
    setActive((v) => !v);
  };

  const toggleWake = () => {
    if (!hasSpeech()) return toast.error("Voice not supported");
    if (!wake) {
      setWake(true);
      // ensure recognition is running; do not flip off in onend
      setActive(true);
      toast.success('Wake-word enabled. Say: “Hey voice …”');
    } else {
      setWake(false);
      setActive(false);
      try { recRef.current?.stop(); } catch {}
      toast.message("Wake-word disabled.");
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          ref={btnRef}
          onClick={toggleListenOnce}
          variant={active ? "default" : "outline"}
          size="icon"
          className={active ? "bg-black text-white" : ""}
          title={active ? "Listening…" : "Voice assistant"}
        >
          {active ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>

        {/* Wake word toggle */}
        <Button
          variant={wake ? "default" : "outline"}
          size="sm"
          onClick={toggleWake}
          title="Enable wake word (Hey voice …)"
        >
          {wake ? "Wake: ON" : "Wake: OFF"}
        </Button>
      </div>

      {/* Floating bubble (“Heard: …”) */}
      {heard &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: bubblePos.top,
              left: bubblePos.left,
              zIndex: 1000,
              maxWidth: 260,
            }}
            className="rounded-xl border bg-white shadow-md px-3 py-2"
          >
            <div className="text-xs text-slate-500 mb-1">Heard:</div>
            <div className="text-sm font-medium break-words">{heard}</div>
          </div>,
          document.body
        )}
    </>
  );
}