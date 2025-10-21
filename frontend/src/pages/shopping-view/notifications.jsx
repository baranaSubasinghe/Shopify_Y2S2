// src/pages/NotificationsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/store/shop/user-notifications-slice";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellDot,
  Check,
  Trash2,
  RefreshCcw,
  Filter,
  MailOpen,
  Info,
} from "lucide-react";

function clsx(...xs) { return xs.filter(Boolean).join(" "); }
function relTime(dateish) {
  const d = new Date(dateish);
  if (isNaN(d)) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const map = [
    ["year", 31536000], ["month", 2592000], ["week", 604800],
    ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1],
  ];
  for (const [u, s] of map) {
    const v = Math.floor(diff / s);
    if (Math.abs(v) >= 1) return rtf.format(-v, u);
  }
  return "just now";
}

// keep type tags as-is; only icons + unread accents changed
const typeColors = {
  ORDER:   "bg-indigo-50 text-indigo-700 ring-indigo-200",
  PAYMENT: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  SECURITY: "bg-amber-50 text-amber-700 ring-amber-200", 
  SYSTEM:  "bg-rose-50 text-rose-700 ring-rose-200",
  INFO:    "bg-sky-50 text-sky-700 ring-sky-200",
};

function SkeletonRow() {
  return (
    <div className="p-4 rounded-xl border bg-white shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-gray-200" />
          <div className="h-4 w-64 rounded bg-gray-200" />
          <div className="h-3 w-40 rounded bg-gray-200" />
        </div>
        <div className="h-8 w-28 rounded bg-gray-200" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const { items = [], isLoading, error } = useSelector((s) => s.userNotifs);

  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => { dispatch(fetchUserNotifications()); }, [dispatch]);

  const unread = items.reduce((n, x) => (x?.isRead ? n : n + 1), 0);

  const list = useMemo(() => {
    const base = showUnreadOnly ? items.filter((n) => !n?.isRead) : items;
    return [...base].sort((a, b) => {
      if (!!a.isRead !== !!b.isRead) return a.isRead ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [items, showUnreadOnly]);

  const onRefresh = () => dispatch(fetchUserNotifications());
  const onMarkAll = () => dispatch(markAllNotificationsRead());
  const onMark = (id) => dispatch(markNotificationRead(id));
  const onDelete = (id) => { if (window.confirm("Delete this notification?")) dispatch(deleteNotification(id)); };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            {/* was text-indigo-600 -> black */}
            <Bell className="h-6 w-6 text-black" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total: <span className="font-medium">{items.length}</span> • Unread:{" "}
            {/* was indigo -> emerald */}
            <span className={clsx("font-medium", unread ? "text-emerald-600" : "text-foreground")}>
              {unread}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowUnreadOnly((v) => !v)}
            className={clsx(
              "inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition",
              showUnreadOnly
                ? "bg-black text-white border-black"     // active = black
                : "bg-white hover:bg-gray-50 border-gray-200"
            )}
            title="Filter"
          >
            <Filter className="h-4 w-4" />
            {showUnreadOnly ? "Unread" : "All"}
          </button>

          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm border-gray-200"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          <button
            onClick={onMarkAll}
            disabled={!unread}
            className={clsx(
              "inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm",
              unread
                ? "bg-white hover:bg-gray-50 border-gray-200"
                : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
            )}
          >
            <Check className="h-4 w-4" />
            Mark all read
          </button>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 p-3 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5" />
          <div>
            <div className="font-medium">Couldn’t load notifications</div>
            <div className="text-sm opacity-80">{String(error)}</div>
          </div>
        </div>
      ) : null}

      {/* Loading / Empty / List */}
      {isLoading ? (
        <div className="space-y-2">
          <SkeletonRow /><SkeletonRow /><SkeletonRow />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-black">
            <MailOpen className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold">You’re all caught up</div>
          <div className="text-sm text-muted-foreground">
            We’ll drop important updates here as they happen.
          </div>
          <button
            onClick={onRefresh}
            className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm border-gray-200"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {list.map((n) => {
              const color =
                typeColors[(n.type || "INFO").toUpperCase()] ||
                "bg-slate-50 text-slate-700 ring-slate-200";

              return (
                <motion.li
                  key={n._id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className={clsx(
                    "p-4 rounded-xl border bg-white shadow-sm",
                    // unread ring: emerald instead of indigo
                    n.isRead ? "opacity-80" : "ring-1 ring-emerald-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {/* type chip stays colored */}
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ring-1",
                            color
                          )}
                        >
                          {/* chip icon inherits chip color; that's fine */}
                          <BellDot className="h-4 w-4" />
                          {(n.type || "Notice").toString().toUpperCase()}
                        </span>

                        {/* New badge now green */}
                        {!n.isRead && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white text-[10px] px-2 py-0.5">
                            <BellDot className="h-3 w-3" />
                            New
                          </span>
                        )}
                      </div>

                      <div className="font-medium leading-snug">
                        {n.title || "Notification"}
                      </div>

                      {n.message ? (
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {n.message}
                        </div>
                      ) : null}

                      <div className="text-xs text-muted-foreground mt-2">
                        {relTime(n.createdAt)} • {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      {!n.isRead && (
                        <button
                          onClick={() => onMark(n._id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm border-gray-200"
                        >
                          <Check className="h-4 w-4" />
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(n._id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm border-gray-200 text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}