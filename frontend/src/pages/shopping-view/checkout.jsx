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

  // live total from current cart state
  const totalCartAmount = useMemo(() => {
    const items = cartItems?.items || [];
    return items.reduce((sum, row) => {
      const p = row?.productId;
      const unit = (p?.salePrice > 0 ? p?.salePrice : p?.price) || 0;
      const qty = row?.quantity || 0;
      return sum + unit * qty;
    }, 0);
  }, [cartItems]);

  function handleInitiatePayHerePayment() {
    const items = cartItems?.items || [];

    if (!items.length) {
      toast.error("Your cart is empty. Please add items to proceed");
      return;
    }
    if (!currentSelectedAddress) {
      toast.error("Please select one address to proceed.");
      return;
    }
    if (!window.payhere) {
      toast.error(
        "PayHere SDK not loaded. Add <script src='https://www.payhere.lk/lib/payhere.js'> to frontend/index.html"
      );
      return;
    }

    const orderData = {
      userId: user?.id,
      cartId: cartItems?._id,
      cartItems: items.map((row) => ({
        productId: row?.productId?._id, // send product id
        title: row?.productId?.title,
        image: row?.productId?.image,   // image from product
        price:
          (row?.productId?.salePrice > 0
            ? row?.productId?.salePrice
            : row?.productId?.price) || 0,
        quantity: row?.quantity,
      })),
      addressInfo: {
        addressId: currentSelectedAddress?._id,
        firstName: currentSelectedAddress?.firstName,
        lastName: currentSelectedAddress?.lastName,
        email: currentSelectedAddress?.email,
        city: currentSelectedAddress?.city,
        country: currentSelectedAddress?.country,
        zipCode: currentSelectedAddress?.zipCode,
        address: currentSelectedAddress?.address,
        phone: currentSelectedAddress?.phone,
        notes: currentSelectedAddress?.notes,
      },
      orderStatus: "pending",
      paymentMethod: "payhere",
      paymentStatus: "pending",
      totalAmount: totalCartAmount,
      orderDate: new Date(),
      orderUpdateDate: new Date(),
      paymentId: "",
      payerId: "",
    };

    setIsPaymentStart(true);

    dispatch(createNewOrder(orderData))
      .unwrap()
      .then((data) => {
        if (!data?.success || !data?.payment) {
          setIsPaymentStart(false);
          toast.error("Failed to start payment. Please try again.");
          return;
        }

        const createdOrderId = data.orderId;

        window.payhere.onCompleted = function () {
          toast.success("Payment completed!");
          if (createdOrderId) navigate(`/orders/${createdOrderId}`);
        };
        window.payhere.onDismissed = function () {
          setIsPaymentStart(false);
          toast("Payment dismissed");
        };
        window.payhere.onError = function (error) {
          setIsPaymentStart(false);
          toast.error(`Payment error: ${error}`);
        };

        window.payhere.startPayment(data.payment);
      })
      .catch(() => {
        setIsPaymentStart(false);
        toast.error("Payment start failed.");
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
          selectedAddressId={currentSelectedAddress?._id}
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
