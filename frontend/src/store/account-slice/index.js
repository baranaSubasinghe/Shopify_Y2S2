// frontend/src/store/account-slice/index.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001";

export const fetchMe = createAsyncThunk("account/fetchMe", async () => {
  const { data } = await axios.get(`${API}/api/user/account/me`, { withCredentials: true });
  return data.data;
});

export const changePassword = createAsyncThunk(
  "account/changePassword",
  async ({ currentPassword, newPassword }) => {
    const { data } = await axios.patch(
      `${API}/api/user/account/password`,
      { currentPassword, newPassword },
      { withCredentials: true }
    );
    return data;
  }
);

export const deleteMyAccount = createAsyncThunk("account/deleteMyAccount", async () => {
  const { data } = await axios.delete(`${API}/api/user/account/me`, { withCredentials: true });
  return data;
});

const slice = createSlice({
  name: "account",
  initialState: { me: null, status: "idle" },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchMe.pending, (s) => { s.status = "loading"; });
    b.addCase(fetchMe.fulfilled, (s, a) => { s.status = "succeeded"; s.me = a.payload; });
    b.addCase(fetchMe.rejected, (s) => { s.status = "failed"; s.me = null; });
  },
});

export default slice.reducer;
