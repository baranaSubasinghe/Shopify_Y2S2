// frontend/src/pages/shopping-view/checkout.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";

import Address from "@/components/shopping-view/address";
import UserCartItemsContent from "@/components/shopping-view/cart-items-content";
import { Button } from "@/components/ui/button";
import img from "@/assets/account.jpg";
import { createNewOrder } from "@/store/shop/order-slice";

// ---------- envs ----------
const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
const PAYHERE_ENV = (import.meta.env.VITE_PAYHERE_ENV || "sandbox").toLowerCase();

// PayHere’s official loader urls
const getPayHereSdkUrl = () =>
  PAYHERE_ENV === "production"
    ? "https://www.payhere.lk/lib/payhere.js"
    : "https://sandbox.payhere.lk/lib/payhere.js";

// ---------- helpers ----------
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clampPosInt = (v, d = 1) => {
  const n = Math.max(0, Math.trunc(num(v, d)));
  return n || d;
};

// Ensure PayHere SDK is on the page once
function usePayHereSdk() {
  const [ready, setReady] = useState(!!window.payhere);
  const inFlight = useRef(false);

  useEffect(() => {
    if (ready || inFlight.current) return;
    if (window.payhere) {
      setReady(true);
      return;
    }
    inFlight.current = true;

    const script = document.createElement("script");
    script.src = getPayHereSdkUrl();
    script.async = true;
    script.onload = () => {
      inFlight.current = false;
      setReady(!!window.payhere);
    };
    script.onerror = () => {
      inFlight.current = false;
      toast.error("Failed to load PayHere SDK.");
    };
    document.head.appendChild(script);

    // cleanup (don’t remove script tag; may be reused)
    return () => {};
  }, [ready]);

  return ready;
}

export default function ShoppingCheckout() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { cartItems } = useSelector((s) => s.shopCart);  // cartItems?.items is array
  const { user } = useSelector((s) => s.auth);

  const [currentSelectedAddress, setCurrentSelectedAddress] = useState(null);
  const [isPaymentStart, setIsPaymentStart] = useState(false);
  const [method, setMethod] = useState("payhere"); // 'payhere' | 'cod'

  const payhereReady = usePayHereSdk();

  const itemsArray = useMemo(() => Array.isArray(cartItems?.items) ? cartItems.items : [], [cartItems]);

  const totalCartAmount = useMemo(() => {
    return itemsArray.reduce((sum, row) => {
      // use salePrice if valid else price; both numeric
      const unit = num(row?.salePrice) > 0 ? num(row?.salePrice) : num(row?.price);
      const qty  = clampPosInt(row?.quantity, 1);
      return sum + unit * qty;
    }, 0);
  }, [itemsArray]);

  // shared validators
  const ensureReady = () => {
    if (!itemsArray.length) {
      toast.error("Your cart is empty. Please add items to proceed");
      return false;
    }
    if (!currentSelectedAddress?._id) {
      toast.error("Please select a delivery address first");
      return false;
    }
    return true;
  };

  // build address info exactly as backend expects
  const buildAddressInfo = () => {
    const a = currentSelectedAddress || {};
    const zip = a?.zipCode ?? a?.pincode ?? "";
    const country = a?.country || "Sri Lanka";
    return {
      addressId: a?._id,
      firstName: a?.firstName,
      lastName: a?.lastName,
      email: a?.email,
      phone: a?.phone,
      address: a?.address,
      city: a?.city,
      country,
      zipCode: zip,
      notes: a?.notes,
    };
  };

  // serialize cart rows for backend
  const serializeItems = (src) =>
    src.map((row) => {
      const rawPrice =
        row?.salePrice ??
        row?.price ??
        row?.finalPrice ??
        row?.unitPrice ??
        row?.amount;
      // Remove any formatting just in case
      const cleaned = String(rawPrice ?? "").replace(/[^0-9.]/g, "");
      const price = num(cleaned, 0);
      const quantity = clampPosInt(row?.quantity ?? row?.qty, 1);

      return {
        productId: row?.productId ?? row?._id ?? row?.id,
        title: row?.title ?? row?.name ?? "Item",
        image: row?.image,
        price: price > 0 ? price : 0,
        quantity,
      };
    });

  // --- PayHere flow ---
  const handleInitiatePayHerePayment = async () => {
    if (!ensureReady()) return;

    if (!payhereReady || !window.payhere) {
      toast.error("PayHere SDK not loaded yet. Please wait a second and try again.");
      return;
    }

    const orderData = {
      userId: user?.id,
      cartId: cartItems?._id,
      cartItems: serializeItems(itemsArray),
      addressInfo: buildAddressInfo(),
      totalAmount: num(totalCartAmount, 0),
      paymentMethod: "payhere",
    };

    try {
      setIsPaymentStart(true);
      const data = await dispatch(createNewOrder(orderData)).unwrap();

      if (!data?.success || !data?.payment) {
        setIsPaymentStart(false);
        toast.error(data?.message || "Payment init failed");
        return;
      }

      // PayHere callbacks
      window.payhere.onCompleted = () => {
        toast.success("Payment completed");
        // PayHere will redirect to return_url; this is a safeguard
      };
      window.payhere.onDismissed = () => toast("Payment dismissed");
      window.payhere.onError = (error) => toast.error(`Payment error: ${error}`);

      // start overlay
      window.payhere.startPayment(data.payment);
      setIsPaymentStart(false);
    } catch (err) {
      setIsPaymentStart(false);
      const d = err?.response?.data;
      console.error("createNewOrder error:", d || err);
      toast.error(d?.message || err.message || "Payment start failed.");
    }
  };

  // --- COD flow ---
  const handleCreateCODOrder = async () => {
    if (!ensureReady()) return;

    const payload = {
      userId: user?.id,
      cartId: cartItems?._id,
      cartItems: serializeItems(itemsArray),
      addressInfo: buildAddressInfo(),
      totalAmount: num(totalCartAmount, 0),
      paymentMethod: "cod",
    };

    try {
      setIsPaymentStart(true);
      const { data } = await axios.post(`${API}/api/shop/order/create-cod`, payload, {
        withCredentials: true,
      });
      setIsPaymentStart(false);

      if (data?.success && data?.orderId) {
        toast.success("Order placed with Cash on Delivery");
        // navigate to your existing return/invoice view
        navigate(`/payhere-return?orderId=${encodeURIComponent(data.orderId)}`);
      } else {
        toast.error(data?.message || "Failed to create COD order");
      }
    } catch (err) {
      setIsPaymentStart(false);
      console.error("create-cod error:", err);
      toast.error(err?.response?.data?.message || "Failed to create COD order");
    }
  };

  const onPlaceOrder = () => {
    if (isPaymentStart) return; // guard double click
    if (method === "cod") handleCreateCODOrder();
    else handleInitiatePayHerePayment();
  };

  useEffect(() => {
  const onChk = (e) => {
    const m = e.detail?.method;
    if (m === "payhere") setMethod("payhere");
    else if (m === "cod") setMethod("cod");
  };
  const onPlace = () => onPlaceOrder();      // your existing handler

  window.addEventListener("voice-checkout", onChk);
  window.addEventListener("voice-place-order", onPlace);
  return () => {
    window.removeEventListener("voice-checkout", onChk);
    window.removeEventListener("voice-place-order", onPlace);
  };
}, [onPlaceOrder, setMethod]);
  return (
    <div className="flex flex-col">
      {/* cover */}
      <div className="relative h-[300px] w-full overflow-hidden">
        <img src={img} className="h-full w-full object-cover object-center" alt="Cover" />
      </div>

      {/* content */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 p-5">
        {/* Address selector */}
        <Address
          selectedId={currentSelectedAddress?._id}
          setCurrentSelectedAddress={setCurrentSelectedAddress}
        />

        {/* Cart + payment */}
        <div className="flex flex-col gap-4">
          {(itemsArray || []).map((item, idx) => (
            <UserCartItemsContent
              key={
                item?._id ||
                item?.productId?._id ||
                item?.productId ||
                `${item?.title || "row"}-${idx}`
              }
              cartItem={item}
            />
          ))}

          {/* Payment method */}
          <div className="mt-4 rounded-lg border p-3">
            <div className="font-semibold mb-2">Payment Method</div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pm"
                  value="payhere"
                  checked={method === "payhere"}
                  onChange={() => setMethod("payhere")}
                />
                <span>PayHere (Card/Online)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pm"
                  value="cod"
                  checked={method === "cod"}
                  onChange={() => setMethod("cod")}
                />
                <span>Cash on Delivery</span>
              </label>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 space-y-4">
            <div className="flex justify-between">
              <span className="font-bold">Total</span>
              <span className="font-bold">
                {"Rs. "}
                {num(totalCartAmount, 0).toLocaleString("en-LK")}
              </span>
            </div>
          </div>

          {/* Action */}
          <div className="mt-4 w-full">
            <Button onClick={onPlaceOrder} className="w-full" disabled={isPaymentStart}>
              {isPaymentStart
                ? method === "payhere"
                  ? "Processing PayHere..."
                  : "Placing COD order..."
                : method === "payhere"
                ? "Pay with PayHere (LKR)"
                : "Place Order (Cash on Delivery)"}
            </Button>

            {/* tiny hint for PayHere readiness */}
            {method === "payhere" && !payhereReady && (
              <div className="mt-2 text-xs text-slate-500">
                Loading PayHere… if it takes too long, check your ad-blocker/CSP.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}