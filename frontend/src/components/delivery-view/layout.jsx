import { Outlet, Link, useNavigate } from "react-router-dom";
import { TbTruckDelivery } from "react-icons/tb";
import { Button } from "@/components/ui/button";

export default function DeliveryLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // ✅ Clear session / cookies
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/auth/login");
  };

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r shadow-sm p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <TbTruckDelivery size={32}  />
          <h2 className="font-extrabold text-2xl">Delivery Panel</h2>
        </div>

        <nav className="flex-1 space-y-3">
       <Link
  to="/delivery/dashboard"
  className="block px-3 py-2 rounded-md hover:bg-indigo-100 transition"
>
  <span style={{ color: "#000", fontSize: "24px", fontWeight: 700, lineHeight: 1.2 }}>
    📦 Dashboard
  </span>
</Link>
        </nav>

        {/* Logout button at bottom */}
        <Button
          onClick={handleLogout}
          className="mt-auto bg-red-500 hover:bg-red-600 text-white font-semibold"
        >
          Logout
        </Button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}