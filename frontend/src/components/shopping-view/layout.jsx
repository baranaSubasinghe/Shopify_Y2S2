import { Outlet, useLocation } from "react-router-dom";
import ShoppingHeader from "./header";
import AiChatbot from "@/components/ai/chatbot"; 

function ShoppingLayout() {
    const location = useLocation();
    const showChatbot = ["/shop/home", "/shop/listing"].includes(location.pathname);
  return (
    <div className="flex flex-col bg-white overflow-hidden">
      {/* common header */}
      <ShoppingHeader />
      <main className="flex flex-col w-full">
        <Outlet />

     
      </main>
       {/* Only show chatbot on home + products listing */}
      {showChatbot && <AiChatbot />}
    </div>
  );
}

export default ShoppingLayout;
