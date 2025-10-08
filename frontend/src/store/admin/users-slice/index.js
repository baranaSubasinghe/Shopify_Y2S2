// frontend/src/store/admin/users-slice/index.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001";

/** FETCH USERS */
export const fetchUsers = createAsyncThunk(
  "adminUsers/fetch",
  async ({ search = "", page = 1, limit = 50 } = {}) => {
    const { data } = await axios.get(`${API}/api/admin/users`, {
      params: { search, page, limit },
      withCredentials: true,
    });
    return data.data; // { items, total, page, limit }
  }
);

/** DELETE USER */
export const deleteUser = createAsyncThunk(
  "adminUsers/delete",
  async (userId) => {
    await axios.delete(`${API}/api/admin/users/${userId}`, {
      withCredentials: true,
    });
    return { userId };
  }
);

/** UPDATE ROLE */
export const updateUserRole = createAsyncThunk(
  "adminUsers/updateRole",
  async ({ userId, role }) => {
    const { data } = await axios.patch(
      `${API}/api/admin/users/${userId}/role`,
      { role },
      { withCredentials: true }
    );
    return data.data; // the updated user
  }
);

const adminUsersSlice = createSlice({
  name: "adminUsers",
  initialState: {
    items: [],
    total: 0,
    page: 1,
    limit: 50,
    status: "idle",
    search: "",
  },
  reducers: {
    setSearch: (s, a) => {
      s.search = a.payload ?? "";
    },
  },
  extraReducers: (b) => {
    // fetch
    b.addCase(fetchUsers.pending, (s) => {
      s.status = "loading";
    });
    b.addCase(fetchUsers.fulfilled, (s, a) => {
      s.status = "succeeded";
      s.items = a.payload.items || [];
      s.total = a.payload.total || 0;
      s.page = a.payload.page || 1;
      s.limit = a.payload.limit || 50;
    });
    b.addCase(fetchUsers.rejected, (s) => {
      s.status = "failed";
    });

    // delete
    b.addCase(deleteUser.fulfilled, (s, a) => {
      s.items = s.items.filter((u) => u._id !== a.payload.userId);
      s.total = Math.max(0, s.total - 1);
    });

    // update role
    b.addCase(updateUserRole.fulfilled, (s, a) => {
      const u = a.payload;
      const idx = s.items.findIndex((x) => x._id === u._id);
      if (idx !== -1) s.items[idx] = u;
    });
  },
});

export const { setSearch } = adminUsersSlice.actions;
export default adminUsersSlice.reducer;
