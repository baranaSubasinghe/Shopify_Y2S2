// frontend/src/App.jsx
import { Route, Routes, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import AuthLayout from "./components/auth/layout";
import AuthLogin from "./pages/auth/login";
import AuthRegister from "./pages/auth/register";
import ForgotPassword from "./pages/auth/forgot-password";
import ResetPassword from "./pages/auth/reset-password";

import AdminLayout from "./components/admin-view/layout";
import AdminDashboard from "./pages/admin-view/dashboard";
import AdminProducts from "./pages/admin-view/products";
import AdminOrders from "./pages/admin-view/orders";
import AdminFeatures from "./pages/admin-view/features";
import AdminUsersPage from "@/pages/admin-view/users";
import AdminReviewsPage from "./pages/admin-view/reviews";
import AdminPaymentsPage from "@/pages/admin-view/payments";
import FeatureImagesPage from "@/pages/admin-view/feature-images";
import AdminNotificationsPage from "@/pages/admin-view/notifications";

import ShoppingLayout from "./components/shopping-view/layout";
import ShoppingHome from "./pages/shopping-view/home";
import ShoppingListing from "./pages/shopping-view/listing";
import ShoppingCheckout from "./pages/shopping-view/checkout";
import ShoppingAccount from "./pages/shopping-view/account";
import SearchProducts from "./pages/shopping-view/search";

import UnauthPage from "./pages/unauth-page";
import NotFound from "./pages/not-found";
import PayHereReturn from "./pages/shopping-view/payhere-return";
import PayHereCancel from "./pages/shopping-view/payhere-cancel";
import CheckAuth from "./components/common/check-auth";
import AiChatbot from "./components/ai/chatbot"; // (kept if used somewhere)

import DeliveryLayout from "@/components/delivery-view/layout";
import DeliveryDashboard from "@/pages/delivery-view/dashboard"; // optional combined view
import OnlinePaymentsPage from "@/pages/delivery-view/online";
import CodPaymentsPage from "@/pages/delivery-view/cod";

import { Skeleton } from "@/components/ui/skeleton";
import { checkAuth } from "./store/auth-slice";
import axios from "axios";
import NotificationsPage from "./pages/shopping-view/notifications";
axios.defaults.withCredentials = true;

function App() {
  const { user, isAuthenticated, isLoading } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  if (isLoading) return <Skeleton className="w-[800px] bg-black h-[600px]" />;

  return (
    <div className="flex flex-col overflow-hidden bg-white">
      <Routes>
        {/* Root redirect */}
        <Route
          path="/"
          element={
            isAuthenticated
              ? (
                <Navigate
                  to={user?.role === "admin" ? "/admin/dashboard" : "/shop/home"}
                  replace
                />
              )
              : <Navigate to="/auth/login" replace />
          }
        />

        {/* AUTH (public) */}
        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={<AuthLogin />} />
          <Route path="register" element={<AuthRegister />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>

        {/* ADMIN (protected) */}
        <Route
          path="/admin"
          element={
            <CheckAuth isAuthenticated={isAuthenticated} user={user}>
              <AdminLayout />
            </CheckAuth>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="features" element={<AdminFeatures />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="images" element={<FeatureImagesPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
        </Route>

        {/* SHOP (protected) */}
        <Route
          path="/shop"
          element={
            <CheckAuth isAuthenticated={isAuthenticated} user={user}>
              <ShoppingLayout />
            </CheckAuth>
          }
        >
          <Route path="home" element={<ShoppingHome />} />
          <Route path="listing" element={<ShoppingListing />} />
          <Route path="checkout" element={<ShoppingCheckout />} />
          <Route path="account" element={<ShoppingAccount />} />
          <Route path="search" element={<SearchProducts />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        
        

        {/* DELIVERY (protected) */}
        <Route
          path="/delivery"
          element={
            <CheckAuth isAuthenticated={isAuthenticated} user={user}>
              <DeliveryLayout />
            </CheckAuth>
          }
        >
          {/* default -> Online Payments */}
          <Route index element={<OnlinePaymentsPage />} />
          <Route path="online" element={<OnlinePaymentsPage />} />
          <Route path="cod" element={<CodPaymentsPage />} />
          <Route path="dashboard" element={<DeliveryDashboard />} />
        </Route>

        {/* OTHER */}
        <Route path="/unauth-page" element={<UnauthPage />} />
        <Route path="/payhere-return" element={<PayHereReturn />} />
        <Route path="/payhere-cancel" element={<PayHereCancel />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;