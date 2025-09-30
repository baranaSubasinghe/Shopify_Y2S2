import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001";

export const fetchAdminReviews = createAsyncThunk(
  "adminReviews/fetch",
  async ({ search = "", page = 1, limit = 50 } = {}) => {
    const { data } = await axios.get(`${API}/api/admin/reviews`, {
      params: { search, page, limit },
      withCredentials: true,
    });
    return data.data; // {items,total,page,limit}
  }
);

export const deleteAdminReview = createAsyncThunk(
  "adminReviews/delete",
  async (id) => {
    const { data } = await axios.delete(`${API}/api/admin/reviews/${id}`, {
      withCredentials: true,
    });
    return data; // {success, reviewId}
  }
);

const adminReviewsSlice = createSlice({
  name: "adminReviews",
  initialState: {
    items: [],
    total: 0,
    page: 1,
    limit: 50,
    status: "idle",
    search: "",
  },
  reducers: {
    setReviewsSearch(state, action) {
      state.search = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchAdminReviews.pending, (s) => {
      s.status = "loading";
    });
    b.addCase(fetchAdminReviews.fulfilled, (s, a) => {
      s.status = "succeeded";
      s.items = a.payload.items || [];
      s.total = a.payload.total || 0;
      s.page = a.payload.page;
      s.limit = a.payload.limit;
    });
    b.addCase(fetchAdminReviews.rejected, (s) => {
      s.status = "failed";
    });
    b.addCase(deleteAdminReview.fulfilled, (s, a) => {
      s.items = s.items.filter((r) => r._id !== a.payload.reviewId);
      s.total = Math.max(0, s.total - 1);
    });
  },
});

export const { setReviewsSearch } = adminReviewsSlice.actions;
export default adminReviewsSlice.reducer;
