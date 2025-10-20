// frontend/src/components/shopping-view/layout.jsx
import { Outlet, useLocation } from "react-router-dom";
import ShoppingHeader from "./header";
import AiChatbot from "@/components/ai/chatbot";
import VoiceAssistant from "@/components/voice/voice-assistant";

function ShoppingLayout() {
  const location = useLocation();

  // Chatbot: only where you want it
  const showChatbot = ["/shop/home", "/shop/listing"].includes(location.pathname);

  // Voice: show on all /shop/* pages (this layout), so no extra filter needed.
  // We just avoid rendering on auth/admin by keeping this inside ShoppingLayout only.

  return (
    <div className="flex flex-col bg-white overflow-hidden min-h-screen">
      <ShoppingHeader />
      <main className="flex flex-col w-full">
        <Outlet />
      </main>

      {/* Floating mic — sits above the chatbot button */}
      <div className="fixed right-6 bottom-28 z-[80] ">
        <VoiceAssistant />
        
      </div>
      

      {/* “Ask for products” button */}
      {showChatbot && (
        <div className="fixed right-6 bottom-8 z-[50]">
          <AiChatbot />
        </div>
      )}
    </div>
  );
}

export default ShoppingLayout;