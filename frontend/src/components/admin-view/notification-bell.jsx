// frontend/src/components/admin-view/notification-bell.jsx
import { useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  const unread = items.filter((n) => !n.isRead).length;

  async function load() {
    try {
      const { data } = await axios.get(`${API}/api/admin/notifications`, {
        params: { page: 1, limit: 10 },
        withCredentials: true,
      });
      // server returns { success, data: [...], total, unread }
      setItems(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      console.error("[notif] load", e?.response?.data || e);
    }
  }

  async function markAllRead() {
    try {
      await axios.post(
        `${API}/api/admin/notifications/mark-all-read`,
        {},
        { withCredentials: true }
      );
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark as read");
    }
  }

  async function markOneRead(id) {
    // optimistic update
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    try {
      await axios.patch(
        `${API}/api/admin/notifications/${encodeURIComponent(id)}/mark-read`,
        {},
        { withCredentials: true }
      );
    } catch (e) {
      // rollback on failure
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: false } : n)));
      toast.error(e?.response?.data?.message || "Failed to mark read");
    }
  }

  async function removeOne(id) {
    const snapshot = items;
    setItems((cur) => cur.filter((n) => n._id !== id));
    try {
      await axios.delete(
        `${API}/api/admin/notifications/${encodeURIComponent(id)}`,
        { withCredentials: true }
      );
      toast.success("Deleted");
    } catch (e) {
      setItems(snapshot);
      toast.error(e?.response?.data?.message || "Delete failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-red-600 text-[10px] leading-4 text-white text-center px-1">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[320px] max-h-[420px] overflow-auto z-50"
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <button
            onClick={markAllRead}
            className="text-xs underline text-slate-600 hover:text-slate-900"
          >
            Mark all read
          </button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {items.length === 0 ? (
          <div className="px-3 py-6 text-sm text-slate-500">No notifications</div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n._id || n.id}
              onSelect={(e) => e.preventDefault()} // don’t close unless user clicks link
              className="flex items-start gap-2 py-2"
            >
              <span
                className={`mt-1 h-2 w-2 rounded-full ${
                  n.isRead ? "bg-slate-300" : "bg-emerald-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {n.title || "Notification"}
                  {!n.isRead && (
                    <span className="ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      new
                    </span>
                  )}
                </div>
                {n.message ? (
                  <div className="text-xs text-slate-500 line-clamp-2">{n.message}</div>
                ) : null}
                {n.link ? (
                  <Link
                    to={n.link}
                    onClick={() => setOpen(false)}
                    className="text-xs text-emerald-700 underline"
                  >
                    View
                  </Link>
                ) : null}
              </div>

              <div className="flex items-center gap-1 pl-2">
                {!n.isRead && (
                  <button
                    title="Mark read"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markOneRead(n._id);
                    }}
                    className="p-1 rounded hover:bg-slate-100"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                <button
                  title="Delete"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeOne(n._id);
                  }}
                  className="p-1 rounded hover:bg-slate-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />
        <div className="px-2 pb-2">
          <Link
            to="/admin/notifications"
            onClick={() => setOpen(false)}
            className="block w-full text-center text-sm py-2 rounded-md border hover:bg-slate-50"
          >
            View all
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}