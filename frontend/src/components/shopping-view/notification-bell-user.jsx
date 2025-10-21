// src/components/shopping-view/notification-bell-user.jsx
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Bell } from "lucide-react";
import { fetchUserNotifications } from "@/store/shop/user-notifications-slice/index";

export default function NotificationBellUser({ className = "" }) {
  const dispatch = useDispatch();
  const { items } = useSelector((s) => s.userNotifs || { items: [] });
  const unread = (items || []).reduce((n, x) => (x?.isRead ? n : n + 1), 0);

  useEffect(() => {
    dispatch(fetchUserNotifications());
    const id = setInterval(() => dispatch(fetchUserNotifications()), 60000);
    return () => clearInterval(id);
  }, [dispatch]);

  return (
    <Link
      to="/shop/notifications"
      aria-label="Notifications"
      className={`relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-gray-100 transition-colors ${className}`}
      title="Notifications"
    >
      {/* 🔔 Bell icon in black */}
      <Bell className="h-5 w-5 text-black" />

      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] leading-[18px] text-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}