import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth-slice";
import adminProductsSlice from "./admin/products-slice";
import adminOrderSlice from "./admin/order-slice";
import adminUsersReducer from "./admin/users-slice";
import shopProductsSlice from "./shop/products-slice";
import shopCartSlice from "./shop/cart-slice";
import shopAddressSlice from "./shop/address-slice";
import shopOrderSlice from "./shop/order-slice";
import shopSearchSlice from "./shop/search-slice";
import shopReviewSlice from "./shop/review-slice";
import commonFeatureSlice from "./common-slice";
import adminReviewsReducer from "./admin/reviews-slice";
import accountReducer from "./account-slice";
import notificationsReducer from "./admin/notification-slice/index.js";
import userNotifsReducer from "./shop/user-notifications-slice/index.js";

const store = configureStore({
  reducer: {
    auth: authReducer,

    adminProducts: adminProductsSlice,
    adminOrder: adminOrderSlice,

    shopProducts: shopProductsSlice,
    shopCart: shopCartSlice,
    shopAddress: shopAddressSlice,
    shopOrder: shopOrderSlice,
    shopSearch: shopSearchSlice,
    shopReview: shopReviewSlice,
    adminUsers: adminUsersReducer,
    commonFeature: commonFeatureSlice,
    adminReviews: adminReviewsReducer,
    account: accountReducer,
    adminNotifications: notificationsReducer,
    userNotifs: userNotifsReducer,


  },
});

export default store;
