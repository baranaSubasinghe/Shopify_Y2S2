// frontend/src/store/shop/order-slice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

// always send cookies/session to backend
axios.defaults.withCredentials = true;

// small helpers
const pickArray = (res) => {
  const d = res?.data ?? res;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};
const pickObject = (res) => (res?.data ? res.data : res);

const initialState = {
  payment: null,
  approvalURL: null,
  isLoading: false,
  orderId: null,
  orderList: [],
  orderDetails: null,
  listStatus: "idle",
  error: null,
};

/* ---------------------------- NEW: /orders/my ---------------------------- */
export const fetchMyOrders = createAsyncThunk(
  "order/fetchMyOrders",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API}/api/shop/orders/my`, {
        withCredentials: true,
      });
      return pickArray(res);
    } catch (e) {
      return rejectWithValue(
        e?.response?.data || { message: "Failed to load orders" }
      );
    }
  }
);

/* ---------------------------- existing thunks ---------------------------- */
export const createNewOrder = createAsyncThunk(
  "/order/createNewOrder",
  async (orderData, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${API}/api/shop/order/create`, orderData, {
        withCredentials: true,
      });
      return pickObject(res);
    } catch (e) {
      return rejectWithValue(
        e?.response?.data || { message: "Failed to create order" }
      );
    }
  }
);

export const capturePayment = createAsyncThunk(
  "/order/capturePayment",
  async ({ paymentId, payerId, orderId }, { rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${API}/api/shop/order/capture`,
        { paymentId, payerId, orderId },
        { withCredentials: true }
      );
      return pickObject(res);
    } catch (e) {
      return rejectWithValue(
        e?.response?.data || { message: "Failed to capture payment" }
      );
    }
  }
);

// legacy path (still supported by UI)
export const getAllOrdersByUserId = createAsyncThunk(
  "/order/getAllOrdersByUserId",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API}/api/shop/order/list/${userId}`, {
        withCredentials: true,
      });
      return pickObject(res); // { success, data: [...] }
    } catch (e) {
      return rejectWithValue(
        e?.response?.data || { message: "Failed to load orders by user id" }
      );
    }
  }
);

export const getOrderDetails = createAsyncThunk(
  "/order/getOrderDetails",
  async (id, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API}/api/shop/order/details/${id}`, {
        withCredentials: true,
      });
      return pickObject(res); // { success, data: {...} }
    } catch (e) {
      return rejectWithValue(
        e?.response?.data || { message: "Failed to load order details" }
      );
    }
  }
);

/* -------------------------------- slice --------------------------------- */
const shoppingOrderSlice = createSlice({
  name: "shoppingOrderSlice",
  initialState,
  reducers: {
    resetOrderDetails: (state) => {
      state.orderDetails = null;
    },
    clearOrders: (state) => {
      state.orderList = [];
      state.listStatus = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // createNewOrder
      .addCase(createNewOrder.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createNewOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        state.payment = action.payload?.payment || null;
        state.orderId = action.payload?.orderId || null;
        sessionStorage.setItem(
          "currentOrderId",
          JSON.stringify(action.payload?.orderId || null)
        );
      })
      .addCase(createNewOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.payment = null;
        state.orderId = null;
        state.error = action.payload?.message || "Order creation failed";
      })

      // legacy: getAllOrdersByUserId
      .addCase(getAllOrdersByUserId.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getAllOrdersByUserId.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orderList = Array.isArray(action.payload?.data)
          ? action.payload.data
          : [];
      })
      .addCase(getAllOrdersByUserId.rejected, (state, action) => {
        state.isLoading = false;
        state.orderList = [];
        state.error = action.payload?.message || "Load orders failed";
      })

      // getOrderDetails
      .addCase(getOrderDetails.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getOrderDetails.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orderDetails = action.payload?.data || null;
      })
      .addCase(getOrderDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.orderDetails = null;
        state.error = action.payload?.message || "Load order details failed";
      })

      // NEW: fetchMyOrders
      .addCase(fetchMyOrders.pending, (state) => {
        state.listStatus = "loading";
        state.error = null;
      })
      .addCase(fetchMyOrders.fulfilled, (state, action) => {
        state.listStatus = "succeeded";
        state.orderList = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchMyOrders.rejected, (state, action) => {
        state.listStatus = "failed";
        state.orderList = [];
        state.error = action.payload?.message || "Failed to load orders";
      });
  },
});

export const { resetOrderDetails, clearOrders } = shoppingOrderSlice.actions;
export default shoppingOrderSlice.reducer;