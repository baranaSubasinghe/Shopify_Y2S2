import { Button } from "../ui/button";
import { Card, CardContent, CardFooter } from "../ui/card";

function AdminProductTile({
  product,
  setFormData,
  setOpenCreateProductsDialog,
  setCurrentEditedId,
  handleDelete,
}) {
  const hasSale =
    product?.salePrice !== undefined &&
    product?.salePrice !== null &&
    Number(product?.salePrice) > 0;

  return (
    <Card className="w-full max-w-sm mx-auto">
      <div>
        <div className="relative">
          <img
            src={product?.image}
            alt={product?.title}
            className="w-full h-[300px] object-cover rounded-t-lg"
            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
          />
        </div>

        <CardContent>
          <h2 className="text-xl font-bold mb-2 mt-2">{product?.title}</h2>

          {/* --- PRICE (LKR only) --- */}
          <div className="mt-2 flex items-center justify-between">
            {hasSale ? (
              <>
                <span className="line-through text-gray-500">
                  {"Rs. "}{Number(product?.price ?? 0).toLocaleString("en-LK")}
                </span>
                <span className="font-semibold">
                  {"Rs. "}{Number(product?.salePrice ?? 0).toLocaleString("en-LK")}
                </span>
              </>
            ) : (
              <span className="font-semibold">
                {"Rs. "}{Number(product?.price ?? 0).toLocaleString("en-LK")}
              </span>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between items-center">
          <Button
            onClick={() => {
              setOpenCreateProductsDialog(true);
              setCurrentEditedId(product?._id);
              setFormData(product);
            }}
          >
            Edit
          </Button>
          <Button onClick={() => handleDelete(product?._id)}>Delete</Button>
        </CardFooter>
      </div>
    </Card>
  );
}

export default AdminProductTile;
