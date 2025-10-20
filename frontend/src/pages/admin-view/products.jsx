// frontend/src/pages/admin-view/products.jsx
import ProductImageUpload from "@/components/admin-view/image-upload";
import AdminProductCard from "@/components/admin-view/product-tile"; // ⬅️ use the new card
import CommonForm from "@/components/common/form";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addProductFormElements } from "@/config";
import {
  addNewProduct,
  deleteProduct,
  editProduct,
  fetchAllProducts,
} from "@/store/admin/products-slice";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { generateProductsPDF } from "@/utils/pdf/productReport";

const initialFormData = {
  image: null,
  title: "",
  description: "",
  category: "",
  brand: "",
  price: "",
  salePrice: "",
  totalStock: "",
  averageReview: 0,
};

// coerce to non-negative number ('' stays '')
const toNonNegativeNumber = (v) => {
  if (v === "" || v === null || typeof v === "undefined") return "";
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n;
};

function AdminProducts() {
  const [openCreateProductsDialog, setOpenCreateProductsDialog] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [imageFile, setImageFile] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [imageLoadingState, setImageLoadingState] = useState(false);
  const [currentEditedId, setCurrentEditedId] = useState(null);

  const [search, setSearch] = useState("");

  const { productList } = useSelector((state) => state.adminProducts);
  const dispatch = useDispatch();

  // sanitize negatives if user types them
  useEffect(() => {
    setFormData((prev) => {
      const next = { ...prev };
      const p = String(prev.price);
      const sp = String(prev.salePrice);
      const ts = String(prev.totalStock);

      const needsFix =
        (p && (p.includes("-") || Number(p) < 0)) ||
        (sp && (sp.includes("-") || Number(sp) < 0)) ||
        (ts && (ts.includes("-") || Number(ts) < 0));

      if (!needsFix) return prev;

      next.price = toNonNegativeNumber(prev.price);
      next.salePrice = toNonNegativeNumber(prev.salePrice);
      next.totalStock = toNonNegativeNumber(prev.totalStock);
      return next;
    });
  }, [formData.price, formData.salePrice, formData.totalStock]);

  function onSubmit(event) {
    event.preventDefault();

    const price = Number(formData.price || 0);
    const salePrice = Number(formData.salePrice || 0);
    const totalStock = Number(formData.totalStock || 0);

    if (price < 0 || salePrice < 0 || totalStock < 0) {
      toast.error("Price, Sale Price, and Total Stock must be 0 or greater.");
      return;
    }
    if (salePrice > price) {
      toast.error("Sale Price cannot be greater than Price.");
      return;
    }

    const payload = {
      ...formData,
      image: currentEditedId ? formData.image : uploadedImageUrl, // if editing, keep whatever is in formData.image
    };

    if (currentEditedId !== null) {
      dispatch(editProduct({ id: currentEditedId, formData: payload })).then((res) => {
        if (res?.payload?.success) {
          dispatch(fetchAllProducts());
          resetEditor();
          toast.success("Product updated");
        }
      });
    } else {
      dispatch(addNewProduct(payload)).then((res) => {
        if (res?.payload?.success) {
          dispatch(fetchAllProducts());
          resetEditor();
          toast.success("Product created");
        }
      });
    }
  }

  function handleDelete(id) {
    dispatch(deleteProduct(id)).then((res) => {
      if (res?.payload?.success) {
        dispatch(fetchAllProducts());
        toast.success("Product deleted");
      } else {
        toast.error(res?.payload?.message || "Delete failed");
      }
    });
  }

  function isFormValid() {
    const baseValid = Object.keys(formData)
      .filter((key) => key !== "averageReview")
      .map((key) => formData[key] !== "")
      .every((x) => x);

    const price = Number(formData.price || 0);
    const salePrice = Number(formData.salePrice || 0);
    const totalStock = Number(formData.totalStock || 0);

    const numbersOk = price >= 0 && salePrice >= 0 && totalStock >= 0 && salePrice <= price;

    return baseValid && numbersOk;
  }

  const resetEditor = () => {
    setOpenCreateProductsDialog(false);
    setCurrentEditedId(null);
    setFormData(initialFormData);
    setUploadedImageUrl("");
    setImageFile(null);
  };

  useEffect(() => {
    dispatch(fetchAllProducts());
  }, [dispatch]);

  // search filter (title / brand / category / id)
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return productList || [];
    const q = search.toLowerCase();
    return (productList || []).filter((p) => {
      const title = (p?.title || "").toLowerCase();
      const brand = (p?.brand || "").toLowerCase();
      const category = (p?.category || "").toLowerCase();
      const id = (p?._id || "").toLowerCase();
      return title.includes(q) || brand.includes(q) || category.includes(q) || id.includes(q);
    });
  }, [productList, search]);

  const onDownloadPDF = () => {
    const ok = generateProductsPDF(filteredProducts);
    if (!ok) toast.error("Failed to generate PDF. Check console for details.");
  };

  // when clicking "Edit" on a card
  const openEdit = (prod) => {
    setCurrentEditedId(prod._id);
    setOpenCreateProductsDialog(true);
    setUploadedImageUrl(prod.image || ""); // keep preview if your uploader uses it
    setFormData({
      image: prod.image || "",
      title: prod.title || "",
      description: prod.description || "",
      category: prod.category || "",
      brand: prod.brand || "",
      price: prod.price ?? "",
      salePrice: prod.salePrice ?? "",
      totalStock: prod.totalStock ?? "",
      averageReview: prod.averageReview ?? 0,
    });
  };

  return (
    <Fragment>
      {/* Header row: Search + Actions */}
      <div className="mb-5 w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title / brand / category / ID..."
            className="w-full sm:w-96 rounded-xl border border-gray-300 bg-transparent px-4 py-2 outline-none focus:border-gray-500"
          />
          <Button
            variant="outline"
            onClick={onDownloadPDF}
            disabled={(filteredProducts?.length || 0) === 0}
            title={(filteredProducts?.length || 0) === 0 ? "No products to export" : "Download PDF"}
          >
            Download PDF
          </Button>
        </div>

        <div className="w-full sm:w-auto flex justify-end">
          <Button onClick={() => setOpenCreateProductsDialog(true)}>Add New Product</Button>
        </div>
      </div>

      {/* Products grid */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {filteredProducts && filteredProducts.length > 0
          ? filteredProducts.map((p) => (
              <AdminProductCard
                key={p._id}
                product={p}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))
          : null}
      </div>

      {/* Add/Edit Sheet */}
      <Sheet
        open={openCreateProductsDialog}
        onOpenChange={resetEditor}
      >
        <SheetContent side="right" className="overflow-auto">
          <SheetHeader>
            <SheetTitle>{currentEditedId !== null ? "Edit Product" : "Add New Product"}</SheetTitle>
          </SheetHeader>

          <ProductImageUpload
            imageFile={imageFile}
            setImageFile={setImageFile}
            uploadedImageUrl={uploadedImageUrl}
            setUploadedImageUrl={setUploadedImageUrl}
            setImageLoadingState={setImageLoadingState}
            imageLoadingState={imageLoadingState}
            isEditMode={currentEditedId !== null}
          />

          <div className="py-6">
            <CommonForm
              onSubmit={onSubmit}
              formData={formData}
              setFormData={setFormData}
              buttonText={currentEditedId !== null ? "Edit" : "Add"}
              formControls={addProductFormElements}
              isBtnDisabled={!isFormValid()}
            />
          </div>
        </SheetContent>
      </Sheet>
    </Fragment>
  );
}

export default AdminProducts;