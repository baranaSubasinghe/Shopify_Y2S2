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
  const recRef = useRef(null);
  const hideTimer = useRef(null);

  const [active, setActive] = useState(false);
  const [heard, setHeard] = useState("");
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0, width: 0 });

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

  useEffect(() => {
    if (!active) return;

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
      // most common: "no-speech" or "not-allowed"
      toast.error(e?.error || "Voice recognition error");
      setActive(false);
    };
    rec.onend = () => setActive(false);

    recRef.current = rec;
    rec.start();

    return () => {
      try { rec.stop(); } catch {}
      recRef.current = null;
    };
  }, [active]);

  const showBubbleTemporarily = () => {
    updatePos();
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHeard(""), 2500);
  };

  /* ----------------------------------------------------------------
   * COMMANDS SUPPORTED (examples users can say)
   *  • "open home" / "go home"
   *  • "open products" / "show products"
   *  • "open cart" / "show bag"
   *  • "open account" / "show profile"
   *  • "search for black t shirt"
   *  • "show category men" (men|women|kids|footwear|accessories)
   *  • "checkout"  (opens checkout)
   *  • "pay with payhere" / "use payhere"
   *  • "cash on delivery" / "use cod"
   *  • "place order"
   *  • "logout" / "log out"
   *  • "back" / "forward" / "refresh"
   *  • "stop listening"
   *
   * NOTE:
   *   For checkout actions we fire custom events so your checkout page
   *   can respond without tight coupling:
   *     - 'voice-checkout'  { detail: { method: 'payhere'|'cod'|null } }
   *     - 'voice-place-order'
   *     - 'open-cart' (your header already listens for this)
   *   See “Wiring on pages” further below.
   * ---------------------------------------------------------------- */
  const handleCommand = (raw) => {
    const phrase = raw.toLowerCase().trim();

    // quick helpers
    const go = (path) => nav(path);
    const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

    // navigation
    if (/(go|open)\s+home\b/.test(phrase)) return go("/shop/home");
    if (/(go|open|show)\s+(products|product list)/.test(phrase))
      return go("/shop/listing");
    if (/(open|show).*(cart|bag)/.test(phrase)) return emit("open-cart");
    if (/(open|show).*(account|profile)/.test(phrase)) return go("/shop/account");

    // browser basics
    if (/^back$/.test(phrase)) return window.history.back();
    if (/^forward$/.test(phrase)) return window.history.forward();
    if (/^refresh$|^reload$/.test(phrase)) return window.location.reload();

    // stop
    if (/stop (listening|voice)/.test(phrase)) {
      try { recRef.current?.stop(); } catch {}
      setActive(false);
      return;
    }

    // search
    const mSearch = phrase.match(/(?:search|find|look up)\s+(?:for\s+)?(.+)/);
    if (mSearch?.[1]) {
      const q = mSearch[1].trim();
      if (q) go(`/shop/search?q=${encodeURIComponent(q)}`);
      return;
    }

    // category
    const mCat = phrase.match(/(?:show|open)\s+(?:category\s+)?(men|women|kids|footwear|accessories)\b/);
    if (mCat?.[1]) {
      const cat = mCat[1];
      // same behavior as clicking the header menu
      go(`/shop/listing?category=${encodeURIComponent(cat)}`);
      return;
    }

    // checkout entry
    if (/^(checkout|go to checkout|proceed to checkout)$/.test(phrase)) {
      go("/shop/checkout");
      emit("voice-checkout", { method: null });
      return;
    }

    // choose payment
    if (/(payhere|pay here|card|online payment)/.test(phrase)) {
      go("/shop/checkout");
      emit("voice-checkout", { method: "payhere" });
      toast.success("Payment method set to PayHere");
      return;
    }
    if (/(cash on delivery|cod|cash)/.test(phrase)) {
      go("/shop/checkout");
      emit("voice-checkout", { method: "cod" });
      toast.success("Payment method set to Cash on Delivery");
      return;
    }

    // place order
    if (/^(place order|confirm order|complete order|pay now)$/.test(phrase)) {
      emit("voice-place-order");
      toast.message("Placing order…");
      return;
    }

    // logout
    if (/^(logout|log out|sign out)$/.test(phrase)) {
      dispatch(logoutUser());
      toast.success("Logged out");
      go("/auth/login");
      return;
    }

    // add-to-cart (very simple heuristic)
    // e.g. "add 2 black t shirt to cart" OR "add black t shirt"
    const mAdd = phrase.match(/^add(?:\s+(\d+))?\s+(.+?)(?:\s+to cart)?$/);
    if (mAdd) {
      const qty = Number(mAdd[1] || 1);
      const name = (mAdd[2] || "").trim();
      if (name) {
        emit("voice-add-to-cart", { name, qty: Math.max(1, qty) });
        toast.success(`Trying to add ${qty} × ${name}`);
        return;
      }
    }

    toast.info(`Heard: "${raw}"`);
  };

  const toggle = () => {
    if (!hasSpeech()) {
      toast.error("Voice not supported on this browser");
      return;
    }
    if (active) {
      try { recRef.current?.stop(); } catch {}
      setActive(false);
    } else {
      updatePos();
      setActive(true);
    }
  };

  return (
    <>
      <Button
        ref={btnRef}
        onClick={toggle}
        variant={active ? "default" : "outline"}
        size="icon"
        className={active ? "bg-black text-white" : ""}
        title={active ? "Listening…" : "Voice assistant"}
      >
        {active ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </Button>

      {/* Floating “Heard” bubble rendered to the body with a high z-index */}
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