import {  Route, Routes } from "react-router-dom"
import AuthLayout from "./components/auth/layout.jsx"
import AuthLogin from "./pages/auth/login.jsx"
import AuthRegister from "./pages/auth/register.jsx"
import AdminLayout from "./components/admin-view/layout.jsx"
import AdminDashboard from "./pages/admin-view/dashboard.jsx"
import NotFound from "./pages/not-found/index.jsx"
import ShoppingLayout from "./components/shopping-view/layout.jsx"
import ShoppingHome from "./pages/shopping-view/home.jsx"
import CheckAuth from "./components/common/check-auth.jsx"
import { useDispatch, useSelector } from "react-redux";
import UnauthPage from "./pages/unauth-page/index.jsx"
import { checkAuth } from "./store/auth-slice/index.js"
import { useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton";

//import { CheckAuth } from "./components/auth/check-auth";

function App() {

  const { user, isAuthenticated, isLoading } = useSelector(
    state => state.auth
  );
 const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  if (isLoading) return <Skeleton className="w-[800] bg-black h-[600px]" />;

  console.log(isLoading, user); 
  
  return (
   <div className="flex flex-col overflow-hidden bg-white">
    
    <Routes>

       <Route
          path="/"
          element={
            <CheckAuth
              isAuthenticated={isAuthenticated}
              user={user}
            ></CheckAuth>
          }
        />

      <Route
          path="/auth"
          element={
            <CheckAuth isAuthenticated={isAuthenticated} user={user}>
              <AuthLayout />
            </CheckAuth>
          }
        >
          <Route path="login" element={<AuthLogin />} />
          <Route path="register" element={<AuthRegister />} />
        </Route>
    <Route
          path="/admin"
          element={
            <CheckAuth isAuthenticated={isAuthenticated} user={user}>
              <AdminLayout />
            </CheckAuth>
          }
        >
          <Route path="dashboard" element={<AdminDashboard/>} />
           {/* <Route path="products" element={<AdminProducts />} />  */}
          {/* <Route path="orders" element={<AdminOrders />} /> */}
          {/* <Route path="features" element={<AdminFeatures />} />  */}
        </Route>

          <Route
          path="/shop"
          element={
            <CheckAuth isAuthenticated={isAuthenticated} user={user}>
              <ShoppingLayout />
           </CheckAuth>
          }
        >
          <Route path="home" element={<ShoppingHome />} />
          {/*<Route path="home" element={<ShoppingHome />} />
          <Route path="listing" element={<ShoppingListing/>} />
          <Route path="checkout" element={<ShoppingCheckout />} />
          <Route path="account" element={<ShoppingAccount />} />
          <Route path="paypal-return" element={<PaypalReturnPage />} />
          <Route path="payment-success" element={<PaymentSuccessPage />} />
          <Route path="search" element={<SearchProducts />} /> */}
        </Route>

        <Route path="/unauth-page" element={<UnauthPage />} />
        <Route path="*" element={<NotFound />} />

    </Routes>
   </div>
    
  )
}

export default App
