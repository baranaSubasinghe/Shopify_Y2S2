import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
axios.defaults.withCredentials = true;

export const fetchNotifications = createAsyncThunk(
  "notifications/fetch",
  async (params = {}) => {
    const { data } = await axios.get(`${API}/api/admin/notifications`, { params });
    return data;
  }
);

export const fetchUnreadCount = createAsyncThunk(
  "notifications/unreadCount",
  async () => {
    const { data } = await axios.get(`${API}/api/admin/notifications/unread-count`);
    return data;
  }
);

export const markRead = createAsyncThunk(
  "notifications/markRead",
  async (id) => {
    const { data } = await axios.patch(`${API}/api/admin/notifications/${id}/read`);
    return data;
  }
);

export const markAllRead = createAsyncThunk(
  "notifications/markAllRead",
  async () => {
    const { data } = await axios.patch(`${API}/api/admin/notifications/mark-all-read`);
    return data;
  }
);

export const removeNotification = createAsyncThunk(
  "notifications/remove",
  async (id) => {
    const { data } = await axios.delete(`${API}/api/admin/notifications/${id}`);
    return { id, data };
  }
);

const slice = createSlice({
  name: "adminNotifications",
  initialState: {
    items: [],
    total: 0,
    unread: 0,
    status: "idle",
  },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchNotifications.fulfilled, (s, a) => {
      s.items = a.payload?.data || [];
      s.total = a.payload?.total || 0;
      s.status = "succeeded";
    });
    b.addCase(fetchUnreadCount.fulfilled, (s, a) => {
      s.unread = a.payload?.count || 0;
    });
    b.addCase(markRead.fulfilled, (s, a) => {
      const n = a.payload?.data;
      if (!n) return;
      s.items = s.items.map((it) => (it._id === n._id ? n : it));
      s.unread = Math.max(0, s.unread - 1);
    });
    b.addCase(markAllRead.fulfilled, (s) => {
      s.items = s.items.map((it) => ({ ...it, isRead: true }));
      s.unread = 0;
    });
    b.addCase(removeNotification.fulfilled, (s, a) => {
      s.items = s.items.filter((it) => it._id !== a.payload.id);
    });
  },
});

export default slice.reducer;