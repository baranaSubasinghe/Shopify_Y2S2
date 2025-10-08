import { Button } from "../ui/button";
import { Card, CardContent, CardFooter } from "../ui/card";
import { Label } from "../ui/label";

function AddressCard({
  addressInfo,
  handleDeleteAddress,
  handleEditAddress,
  setCurrentSelectedAddress,
  selectedId,
}) {
  const isActive = String(selectedId || "") === String(addressInfo?._id || "");

  return (
    <Card
      onClick={
        setCurrentSelectedAddress
          ? () => setCurrentSelectedAddress(addressInfo)
          : undefined
      }
      className={`cursor-pointer transition rounded-lg border p-3 ${
        isActive ? "border-primary ring-1 ring-primary" : "border-muted"
      }`}
    >
      <CardContent className="grid p-4 gap-2">
        <Label>Address: {addressInfo?.address}</Label>
        <Label>City: {addressInfo?.city}</Label>
        <Label>Pincode: {addressInfo?.pincode}</Label>
        <Label>Phone: {addressInfo?.phone}</Label>
        <Label>Notes: {addressInfo?.notes}</Label>
      </CardContent>

      <CardFooter className="p-3 flex justify-between">
        <Button
          onClick={(e) => {
            e.stopPropagation(); // prevent selecting the card
            handleEditAddress(addressInfo);
          }}
          variant="outline"
        >
          Edit
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation(); // prevent selecting the card
            handleDeleteAddress(addressInfo);
          }}
          variant="destructive"
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}

export default AddressCard;
