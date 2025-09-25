import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001";

export const fetchUsers = createAsyncThunk(
  "adminUsers/fetch",
  async ({ search = "", page = 1, limit = 50 } = {}) => {
    const { data } = await axios.get(
      `${API}/api/admin/users`,
      {
        params: { search, page, limit },
        withCredentials: true,
      }
    );
    return data.data; // {items,total,page,limit}
  }
);

export const deleteUser = createAsyncThunk(
  "adminUsers/delete",
  async (userId) => {
    const { data } = await axios.delete(
      `${API}/api/admin/users/${userId}`,
      { withCredentials: true }
    );
    return { userId, ...data };
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
    setSearch(state, action) {
      state.search = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchUsers.pending, (s) => {
      s.status = "loading";
    });
    b.addCase(fetchUsers.fulfilled, (s, a) => {
      s.status = "succeeded";
      s.items = a.payload.items || [];
      s.total = a.payload.total || 0;
      s.page = a.payload.page;
      s.limit = a.payload.limit;
    });
    b.addCase(fetchUsers.rejected, (s) => {
      s.status = "failed";
    });
    b.addCase(deleteUser.fulfilled, (s, a) => {
      s.items = s.items.filter((u) => u._id !== a.payload.userId);
      s.total = Math.max(0, s.total - 1);
    });
  },
});

export const { setSearch } = adminUsersSlice.actions;
export default adminUsersSlice.reducer;
