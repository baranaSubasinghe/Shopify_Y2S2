// frontend/src/components/delivery-view/layout.jsx
import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import axios from "axios";
import {
  Truck,
  CreditCard,
  Wallet2,
  ListChecks,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutUser } from "@/store/auth-slice";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
axios.defaults.withCredentials = true;

function SidebarLink({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-medium transition-colors",
          isActive
            ? "bg-green-100 text-black shadow-sm"
            : "text-black hover:bg-green-50",
        ].join(" ")
      }
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white">
        <Icon className="h-4 w-4" />
      </span>
      {label}
    </NavLink>
  );
}

export default function DeliveryLayout() {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      // invalidate server session/cookie
      await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true });
    } catch {
      /* ignore network errors */
    }
    // clear client state immediately
    dispatch(logoutUser());
    // go to login (replace history so back doesn't bounce you in)
    navigate("/auth/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-white text-slate-900">
      {/* Sidebar */}
      <aside
        className={[
          "w-[280px] border-r bg-white shadow-sm flex flex-col justify-between px-8 py-8",
          "fixed lg:static z-40 transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* top */}
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg leading-tight">Delivery Panel</h1>
              <p className="text-xs text-slate-500">Manage assigned orders</p>
            </div>
          </div>

          {/* nav */}
          <nav className="space-y-2">
            <SidebarLink
              to="/delivery/online"
              icon={CreditCard}
              label="Online Payments"
              onClick={() => setOpen(false)}
            />
            <SidebarLink
              to="/delivery/cod"
              icon={Wallet2}
              label="Cash on Delivery"
              onClick={() => setOpen(false)}
            />
            <SidebarLink
              to="/delivery/dashboard"
              icon={ListChecks}
              label="All Assigned"
              onClick={() => setOpen(false)}
            />
          </nav>
        </div>

        {/* logout */}
        <div className="pt-6 border-t mt-6">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-red-500 text-red-600 py-2.5 font-semibold hover:bg-red-50 transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile toggle */}
      <div className="absolute top-4 left-4 lg:hidden z-50">
        <Button
          variant="outline"
          size="icon"
          className="border border-slate-300 bg-white"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main (centered content) */}
      <main className="flex-1 ml-0 lg:ml-[20px] px-2 py-10 min-h-screen">
        <div className="w-full max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}