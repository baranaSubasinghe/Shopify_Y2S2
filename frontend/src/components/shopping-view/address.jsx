import { useEffect, useMemo, useState } from "react";
import CommonForm from "../common/form";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { addressFormControls } from "@/config";
import { useDispatch, useSelector } from "react-redux";
import {
  addNewAddress,
  deleteAddress,
  editaAddress,
  fetchAllAddresses,
} from "@/store/shop/address-slice";
import AddressCard from "./address-card";
import { toast } from "sonner";

const initialAddressFormData = {
  address: "",
  city: "",
  phone: "",
  pincode: "",
  notes: "",
};

// focus helper
const focusField = (name) => {
  const el =
    document.querySelector(`input[name="${name}"]`) ||
    document.querySelector(`textarea[name="${name}"]`);
  el?.focus();
};

// 🚿 sanitize helpers
const onlyDigits = (s = "") => s.replace(/\D+/g, "");
const onlyLettersAndSpaces = (s = "") => s.replace(/[^A-Za-z\s]+/g, "");

function Address({ setCurrentSelectedAddress, selectedId }) {
  const [formData, setFormData] = useState(initialAddressFormData);
  const [currentEditedId, setCurrentEditedId] = useState(null);

  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { addressList } = useSelector((state) => state.shopAddress);

  const userId = useMemo(() => user?._id || user?.id || null, [user]);

  // ✨ wrap setFormData so inputs are cleaned as the user types
  const setFormDataSanitized = (next) => {
    setFormData((prev) => {
      const raw = typeof next === "function" ? next(prev) : next;

      const sanitized = {
        ...raw,
        // City: letters and spaces only
        city: onlyLettersAndSpaces(raw.city),
        // Phone: digits only (and at most 10 by convention)
        phone: onlyDigits(raw.phone).slice(0, 10),
        // Pincode: digits only (keep your own length rule in validation)
        pincode: onlyDigits(raw.pincode).slice(0, 6), // allow up to 6 for flexibility
      };

      return sanitized;
    });
  };

  async function handleManageAddress(event) {
    event.preventDefault();

    if (!userId) {
      toast.error("Please log in to manage addresses.");
      return;
    }

    if ((addressList?.length || 0) >= 3 && currentEditedId === null) {
      setFormData(initialAddressFormData);
      toast.error("You can add a maximum of 3 addresses.");
      return;
    }

    // one updating toast
    const id = toast.loading("Checking address…");

    // 1) Address
    if (!formData.address || formData.address.trim().length < 5) {
      toast.error("Address must be at least 5 characters.", { id });
      focusField("address");
      return;
    }
    toast.message("Address looks good ✅", { id });

    // 2) City (already sanitized but validate length)
    if (!formData.city || formData.city.trim().length < 2) {
      toast.error("City is required (letters only).", { id });
      focusField("city");
      return;
    }
    toast.message("City looks good ✅", { id });

    // 3) Pincode (strict 5 digits; adjust if your project uses different)
    if (!/^\d{5}$/.test(formData.pincode || "")) {
      toast.error("Pincode must be 5 digits (e.g., 11500).", { id });
      focusField("pincode");
      return;
    }
    toast.message("Pincode looks good ✅", { id });

    // 4) Phone (strict 10 digits starting with 0)
    if (!/^0\d{9}$/.test(formData.phone || "")) {
      toast.error("Phone must be 10 digits and start with 0 (e.g., 0712345678).", { id });
      focusField("phone");
      return;
    }
    toast.message("Phone looks good ✅", { id });

    // 5) Notes
    if ((formData.notes || "").length > 200) {
      toast.error("Notes must be 200 characters or less.", { id });
      focusField("notes");
      return;
    }

    toast.success("All checks passed. Saving…", { id });

    try {
      if (currentEditedId !== null) {
        const out = await dispatch(
          editaAddress({
            userId,
            addressId: currentEditedId,
            formData: {
              ...formData,
              address: formData.address.trim(),
              city: formData.city.trim(),
            },
          })
        );

        if (out?.payload?.success) {
          await dispatch(fetchAllAddresses(userId));
          setCurrentEditedId(null);
          setFormData(initialAddressFormData);
          toast.success("Address updated successfully");
        } else {
          throw new Error(out?.payload?.message || "Failed to update address");
        }
      } else {
        const out = await dispatch(
          addNewAddress({
            ...formData,
            address: formData.address.trim(),
            city: formData.city.trim(),
            userId,
          })
        );

        if (out?.payload?.success) {
          await dispatch(fetchAllAddresses(userId));
          setFormData(initialAddressFormData);
          toast.success("Address added");
        } else {
          throw new Error(out?.payload?.message || "Failed to add address");
        }
      }
    } catch (err) {
      toast.error(err?.message || "Something went wrong while saving.");
    }
  }

  function handleEditAddress(getCurrentAddress) {
    setCurrentEditedId(getCurrentAddress?._id || null);
    // sanitize on prefill too
    setFormData({
      address: getCurrentAddress?.address || "",
      city: onlyLettersAndSpaces(getCurrentAddress?.city || ""),
      phone: onlyDigits(getCurrentAddress?.phone || "").slice(0, 10),
      pincode: onlyDigits(getCurrentAddress?.pincode || "").slice(0, 6),
      notes: getCurrentAddress?.notes || "",
    });
  }

  async function handleDeleteAddress(getCurrentAddress) {
    if (!userId) return;
    const out = await dispatch(
      deleteAddress({ userId, addressId: getCurrentAddress._id })
    );
    if (out?.payload?.success) {
      await dispatch(fetchAllAddresses(userId));
      toast.success("Address deleted successfully");
    } else {
      toast.error(out?.payload?.message || "Failed to delete address");
    }
  }

  useEffect(() => {
    if (userId) dispatch(fetchAllAddresses(userId));
  }, [dispatch, userId]);

  return (
    <Card>
      <div className="mb-5 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.isArray(addressList) && addressList.length > 0
          ? addressList.map((single) => (
              <AddressCard
                key={single?._id}
                selectedId={selectedId}
                handleDeleteAddress={handleDeleteAddress}
                addressInfo={single}
                handleEditAddress={handleEditAddress}
                setCurrentSelectedAddress={setCurrentSelectedAddress}
              />
            ))
          : null}
      </div>

      <CardHeader>
        <CardTitle>
          {currentEditedId !== null ? "Edit Address" : "Add New Address"}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <CommonForm
          formControls={addressFormControls}
          formData={formData}
          // ⬇️ use the sanitizing setter so invalid chars are stripped immediately
          setFormData={setFormDataSanitized}
          buttonText={currentEditedId !== null ? "Save" : "Add"}
          onSubmit={handleManageAddress}
          isBtnDisabled={false}
        />
      </CardContent>
    </Card>
  );
}

export default Address;
