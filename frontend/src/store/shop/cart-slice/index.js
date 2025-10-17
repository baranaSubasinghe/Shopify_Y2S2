import axios from "axios";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001";

const initialState = {
  cartItems: { items: [] },
  isLoading: false,
};

export const addToCart = createAsyncThunk(
  "cart/addToCart",
  async ({ userId, productId, quantity }) => {
    const res = await axios.post(`${API}/api/shop/cart/add`, {
      userId,
      productId,
      quantity,
    });
    return res.data;
  }
);

export const fetchCartItems = createAsyncThunk(
  "cart/fetchCartItems",
  async (userId) => {
    const res = await axios.get(`${API}/api/shop/cart/get/${userId}`);
    return res.data;
  }
);

export const deleteCartItem = createAsyncThunk(
  "cart/deleteCartItem",
  async ({ userId, productId }) => {
    const res = await axios.delete(`${API}/api/shop/cart/${userId}/${productId}`);
    return res.data;
  }
);

export const updateCartQuantity = createAsyncThunk(
  "cart/updateCartQuantity",
  async ({ userId, productId, quantity }) => {
    const res = await axios.put(`${API}/api/shop/cart/update-cart`, {
      userId,
      productId,
      quantity,
    });
    return res.data;
  }
);

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // ADD
      .addCase(addToCart.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.success) {
          state.cartItems = action.payload.data;
          toast.success("Product added to cart"); // ✅ only toast here
        }
      })
      .addCase(addToCart.rejected, (state) => {
        state.isLoading = false;
        toast.error("Failed to add product to cart");
      })

      // FETCH
      .addCase(fetchCartItems.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchCartItems.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.success) {
          state.cartItems = action.payload.data;
        }
      })
      .addCase(fetchCartItems.rejected, (state) => {
        state.isLoading = false;
      })

      // UPDATE
      .addCase(updateCartQuantity.fulfilled, (state, action) => {
        if (action.payload?.success) {
          state.cartItems = action.payload.data;
        }
      })

      // DELETE
      .addCase(deleteCartItem.fulfilled, (state, action) => {
        if (action.payload?.success) {
          state.cartItems = action.payload.data;
        }
      });
  },
});

export default cartSlice.reducer;