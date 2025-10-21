import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
axios.defaults.withCredentials = true;

export const fetchUserNotifications = createAsyncThunk(
  "userNotifs/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/shop/notifications`);
      if (!data?.success) throw new Error(data?.message || "Failed");
      return data.data || [];
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e.message || "Error");
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  "userNotifs/markRead",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`${API}/api/shop/notifications/${id}/read`);
      if (!data?.success) throw new Error(data?.message || "Failed");
      return data.data;
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e.message || "Error");
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  "userNotifs/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/shop/notifications/mark-all-read`);
      if (!data?.success) throw new Error(data?.message || "Failed");
      return true;
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e.message || "Error");
    }
  }
);

export const deleteNotification = createAsyncThunk(
  "userNotifs/delete",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.delete(`${API}/api/shop/notifications/${id}`);
      if (!data?.success) throw new Error(data?.message || "Failed");
      return id;
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e.message || "Error");
    }
  }
);

const slice = createSlice({
  name: "userNotifs",
  initialState: { items: [], isLoading: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchUserNotifications.pending,   (s) => { s.isLoading = true; s.error = null; });
    b.addCase(fetchUserNotifications.fulfilled, (s, a) => { s.isLoading = false; s.items = a.payload; });
    b.addCase(fetchUserNotifications.rejected,  (s, a) => { s.isLoading = false; s.error = a.payload; });

    b.addCase(markNotificationRead.fulfilled, (s, a) => {
      const i = s.items.findIndex(x => x._id === a.payload._id);
      if (i >= 0) s.items[i] = a.payload;
    });

    b.addCase(markAllNotificationsRead.fulfilled, (s) => {
      s.items = s.items.map(x => ({ ...x, isRead: true }));
    });

    b.addCase(deleteNotification.fulfilled, (s, a) => {
      s.items = s.items.filter(x => x._id !== a.payload);
    });
  }
});

export default slice.reducer;