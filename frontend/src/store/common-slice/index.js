import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
const API = import.meta.env.VITE_API_URL || "http://localhost:5001";

const initialState = {
  isLoading: false,
  featureImageList: [],
};

export const getFeatureImages = createAsyncThunk(
  "/order/getFeatureImages",
  async () => {
    const response = await axios.get(
      `http://localhost:5001/api/common/feature/get`
    );

    return response.data;
  }
);

export const addFeatureImage = createAsyncThunk(
  "/order/addFeatureImage",
  async (image) => {
    const response = await axios.post(
      `http://localhost:5001/api/common/feature/add`,
      { image }
    );

    return response.data;
  }
);
export const deleteFeature = createAsyncThunk("common/deleteFeature", async (id) => {
  const { data } = await axios.delete(`${API}/api/common/feature/${id}`, { withCredentials:true });
  return { id, ...data };
});



const commonSlice = createSlice({
  name: "commonSlice",
  initialState,
  reducers: {},
  extraReducers: (builder) => {

    
    builder.
      addCase(deleteFeature.fulfilled, (s, a) => {
       s.features = s.features.filter(f => f._id !== a.payload.id);
      })
      .addCase(getFeatureImages.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getFeatureImages.fulfilled, (state, action) => {
        state.isLoading = false;
        state.featureImageList = action.payload.data;
      })
      .addCase(getFeatureImages.rejected, (state) => {
        state.isLoading = false;
        state.featureImageList = [];
      });
  },
});

export default commonSlice.reducer;
