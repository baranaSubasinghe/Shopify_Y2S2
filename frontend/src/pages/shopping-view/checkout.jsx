import Address from "@/components/shopping-view/address";
import img from "../../assets/account.jpg";
import { useDispatch, useSelector } from "react-redux";
import UserCartItemsContent from "@/components/shopping-view/cart-items-content";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { createNewOrder } from "@/store/shop/order-slice";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

function ShoppingCheckout() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { cartItems } = useSelector((state) => state.shopCart); // cartItems?.items is array
  const { user } = useSelector((state) => state.auth);

  const [currentSelectedAddress, setCurrentSelectedAddress] = useState(null);
  const [isPaymentStart, setIsPaymentStart] = useState(false);

  const totalCartAmount = useMemo(() => {
  const items = cartItems?.items || [];
  return items.reduce((sum, row) => {
    const unit = (Number(row?.salePrice) > 0 ? Number(row?.salePrice) : Number(row?.price)) || 0;
    const qty  = Number(row?.quantity) || 0;
    return sum + unit * qty;
  }, 0);
}, [cartItems]);

 function handleInitiatePayHerePayment() {
  // 1) Get items FIRST (define once)
  const items = cartItems?.items || [];

  // 2) Guards
  if (!items.length) {
    toast.error("Your cart is empty. Please add items to proceed");
    return;
  }
  if (!currentSelectedAddress?._id) {
    toast.error("Please select a delivery address first");
    return;
  }
  if (!window.payhere) {
    toast.error("PayHere SDK not loaded");
    return;
  }

  // 3) Compute total
  const totalCartAmount = items.reduce((sum, row) => {
    const unit =
      (Number(row?.salePrice) > 0 ? Number(row?.salePrice) : Number(row?.price)) || 0;
    const qty = Number(row?.quantity) || 0;
    return sum + unit * qty;
  }, 0);

  // 4) Build payload
  const orderData = {
    userId: user?.id,
    cartId: cartItems?._id,
 cartItems: items.map((row) => {
   const raw = row?.salePrice ?? row?.price ?? row?.finalPrice ?? row?.unitPrice ?? row?.amount;
   const cleaned = String(raw ?? "").replace(/[^0-9.]/g, "");
   const price = Number(cleaned);
   const quantity = Number(row?.quantity ?? row?.qty ?? 1);
  return {
     productId: row?.productId ?? row?._id ?? row?.id,
     title: row?.title ?? row?.name,
     image: row?.image,
     price: Number.isFinite(price) && price > 0 ? price : 0,
     quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
   };
 }),
 
    addressInfo: {
      addressId: currentSelectedAddress?._id,
      firstName: currentSelectedAddress?.firstName,
      lastName: currentSelectedAddress?.lastName,
      email: currentSelectedAddress?.email,
      phone: currentSelectedAddress?.phone,
      address: currentSelectedAddress?.address,
      city: currentSelectedAddress?.city,
      country: currentSelectedAddress?.country,
      zipCode: currentSelectedAddress?.zipCode,
      notes: currentSelectedAddress?.notes,
    },
    totalAmount: Number(totalCartAmount), // keep numeric; backend will toFixed(2)
    paymentMethod: "payhere",
  };

  // 5) Kick off order + payment
  setIsPaymentStart(true);
  dispatch(createNewOrder(orderData))
    .unwrap()
    .then((data) => {
      setIsPaymentStart(false);
      if (!data?.success || !data?.payment) {
        toast.error("Payment init failed");
        return;
      }
      window.payhere.onCompleted = () => toast.success("Payment completed");
      window.payhere.onDismissed = () => toast("Payment dismissed");
      window.payhere.onError = (error) => toast.error(`Payment error: ${error}`);
      window.payhere.startPayment(data.payment);
    })
   .catch((err) => {
  setIsPaymentStart(false);
  const data = err?.response?.data;
  console.error("createNewOrder error:", data || err);
  toast.error(data?.message || err.message || "Payment start failed.");
});
}


  return (
    <div className="flex flex-col">
      <div className="relative h-[300px] w-full overflow-hidden">
        <img
          src={img}
          className="h-full w-full object-cover object-center"
          alt="Cover"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 p-5">
        {/* Address selector (keeps same UI) */}
              <Address
        selectedId={currentSelectedAddress?._id}
        setCurrentSelectedAddress={setCurrentSelectedAddress}
      />
        {/* Cart list + summary (same layout) */}
        <div className="flex flex-col gap-4">
          {/* Render each cart row; component receives the item with productId, image, qty, etc. */}
          {(cartItems?.items || []).map((item) => (
            <UserCartItemsContent
              key={item?._id || item?.productId?._id}
              cartItem={item}
            />
          ))}

          <div className="mt-8 space-y-4">
            <div className="flex justify-between">
              <span className="font-bold">Total</span>
              <span className="font-bold">
                {"Rs. "}
                {Number(totalCartAmount ?? 0).toLocaleString("en-LK")}
              </span>
            </div>
          </div>

          <div className="mt-4 w-full">
            <Button onClick={handleInitiatePayHerePayment} className="w-full">
              {isPaymentStart ? "Processing PayHere..." : "Pay with PayHere (LKR)"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShoppingCheckout;
