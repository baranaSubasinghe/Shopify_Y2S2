// frontend/src/pages/admin-view/notifications.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export default function AdminNotificationsPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);

  async function load(p = page) {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/api/admin/notifications`, {
        params: { page: p, limit },
        withCredentials: true,
      });
      const list = Array.isArray(data?.data) ? data.data : (data?.items || []);
      setItems(list);
      setTotal(Number.isFinite(data?.total) ? data.total : list.length);
      setUnread(Number.isFinite(data?.unread) ? data.unread : list.filter(n => !n.isRead).length);
      setPage(Number(data?.page || p));
    } catch (e) {
      console.error("[notif] load", e?.response?.data || e);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); }, []);

  // actions
  async function markRead(id) {
    try {
      const { data } = await axios.patch(`${API}/api/admin/notifications/${id}/mark-read`, {}, { withCredentials: true });
      if (data?.success) {
        setItems(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        setUnread(x => Math.max(0, x - 1));
      } else {
        toast.error(data?.message || "Failed to mark as read");
      }
    } catch {
      toast.error("Failed to mark as read");
    }
  }

  async function remove(id) {
    try {
      const { data } = await axios.delete(`${API}/api/admin/notifications/${id}`, { withCredentials: true });
      if (data?.success) {
        setItems(prev => prev.filter(n => n._id !== id));
        setTotal(t => Math.max(0, t - 1));
      } else {
        toast.error(data?.message || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function markAllRead() {
    try {
      const { data } = await axios.post(`${API}/api/admin/notifications/mark-all-read`, {}, { withCredentials: true });
      if (data?.success) {
        setItems(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnread(0);
        toast.success("All marked as read");
      }
    } catch {
      toast.error("Failed to mark all");
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <div className="text-sm text-slate-600">
            Total: <b>{total}</b> • Unread: <b>{unread}</b>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => load(page)}>Refresh</Button>
          <Button onClick={markAllRead}>Mark all read</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        {loading ? (
          <div className="p-6">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-slate-500">No notifications</div>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n._id} className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2 w-2 rounded-full ${n.isRead ? "bg-slate-300" : "bg-emerald-600"}`} />
                  <div>
                    <div className="font-medium">{n.title || "Notification"}</div>
                    {n.message && <div className="text-sm text-slate-600">{n.message}</div>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!n.isRead && (
                    <Button size="sm" variant="outline" onClick={() => markRead(n._id)}>
                      Mark read
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => remove(n._id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* simple pager (optional) */}
      <div className="mt-4 flex items-center gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>Prev</Button>
        <div className="text-sm">Page {page}</div>
        <Button variant="outline" disabled={items.length < limit} onClick={() => load(page + 1)}>Next</Button>
      </div>
    </div>
  );
}