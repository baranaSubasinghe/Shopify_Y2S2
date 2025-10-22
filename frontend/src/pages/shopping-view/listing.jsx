// frontend/src/pages/shopping-view/listing.jsx
import ProductFilter from "@/components/shopping-view/filter";
import ProductDetailsDialog from "@/components/shopping-view/product-details";
import ShoppingProductTile from "@/components/shopping-view/product-tile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sortOptions } from "@/config";
import { addToCart, fetchCartItems } from "@/store/shop/cart-slice";
import {
  fetchAllFilteredProducts,
  fetchProductDetails,
} from "@/store/shop/products-slice";
import { ArrowUpDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import ShopFooter from "@/components/shopping-view/footer";

/* ----------------------------- fuzzy helpers ----------------------------- */
const norm = (s = "") =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function levenshtein(a = "", b = "") {
  a = norm(a);
  b = norm(b);
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function ShoppingListing() {
  const dispatch = useDispatch();
  const { productList, productDetails } = useSelector(
    (state) => state.shopProducts
  );
  const { cartItems } = useSelector((state) => state.shopCart);
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);

  const api = useMemo(
    () => import.meta.env.VITE_API_URL || "http://localhost:5001",
    []
  );

  const categorySearchParam = searchParams.get("category");
  const openId = searchParams.get("open");

  // Deep-link from chatbot: /shop/listing?open=<productId>
  useEffect(() => {
    if (!openId) return;

    const target = productList?.find((p) => p._id === openId);
    if (target) {
      dispatch(fetchProductDetails(openId));
      setOpenDetailsDialog(true);
      const el = document.getElementById(`product-${openId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    axios
      .get(`${api}/api/shop/products/${openId}`)
      .then((res) => {
        if (res.data?.success && res.data?.product) {
          dispatch({
            type: "shopProducts/fetchProductDetails/fulfilled",
            payload: res.data,
          });
          setOpenDetailsDialog(true);
        }
      })
      .catch(() => {});
  }, [openId, productList, api, dispatch]);

  function createSearchParamsHelper(filterParams) {
    const queryParams = [];
    for (const [key, value] of Object.entries(filterParams)) {
      if (Array.isArray(value) && value.length > 0) {
        const paramValue = value.join(",");
        queryParams.push(`${key}=${encodeURIComponent(paramValue)}`);
      }
    }
    return queryParams.join("&");
  }

  function handleSort(value) {
    setSort(value);
  }

  function handleFilter(getSectionId, getCurrentOption) {
    let cpyFilters = { ...filters };
    const indexOfCurrentSection = Object.keys(cpyFilters).indexOf(getSectionId);

    if (indexOfCurrentSection === -1) {
      cpyFilters = {
        ...cpyFilters,
        [getSectionId]: [getCurrentOption],
      };
    } else {
      const indexOfCurrentOption =
        cpyFilters[getSectionId].indexOf(getCurrentOption);

      if (indexOfCurrentOption === -1)
        cpyFilters[getSectionId].push(getCurrentOption);
      else cpyFilters[getSectionId].splice(indexOfCurrentOption, 1);
    }

    setFilters(cpyFilters);
    sessionStorage.setItem("filters", JSON.stringify(cpyFilters));
  }

  function handleGetProductDetails(getCurrentProductId) {
    dispatch(fetchProductDetails(getCurrentProductId));
  }

  async function handleAddtoCart(getCurrentProductId, getTotalStock) {
    const uid = user?._id || user?.id;
    if (!isAuthenticated || !uid) {
      console.warn("User not authenticated");
      return;
    }

    let getCartItems = cartItems.items || [];
    if (getCartItems.length) {
      const indexOfCurrentItem = getCartItems.findIndex(
        (item) => item.productId === getCurrentProductId
      );
      if (indexOfCurrentItem > -1) {
        const getQuantity = getCartItems[indexOfCurrentItem].quantity;
        if (getQuantity + 1 > getTotalStock) {
          console.warn(`Only ${getQuantity} quantity can be added for this item`);
          return;
        }
      }
    }

    try {
      const res = await dispatch(
        addToCart({
          userId: uid,
          productId: getCurrentProductId,
          quantity: 1,
        })
      );

      if (res?.payload?.success) {
        await dispatch(fetchCartItems(uid)); // refresh badge
      }
    } catch (err) {
      console.error("AddToCart failed:", err);
    }
  }

  // ▶️ Voice: listen for "voice-add-to-cart" with { name, qty }
  useEffect(() => {
    if (!Array.isArray(productList) || productList.length === 0) return;

    const onVoiceAdd = (e) => {
      const { name, qty = 1 } = e.detail || {};
      if (!name) return;

      const target = norm(name);
      const ranked = productList
        .map((p) => {
          const t = norm(p.title || p.name || "");
          const d = levenshtein(t, target);
          const includesBoost = t.includes(target) ? -2 : 0;
          return { p, score: d + includesBoost };
        })
        .sort((a, b) => a.score - b.score);

      const best = ranked[0];
      if (!best || best.score > 4) {
        toast.error(`Couldn't find a close match for “${name}”.`);
        return;
      }

      const product = best.p;
      const stock = Number(product?.totalStock ?? product?.stock ?? 9999);
      const qtyNum = Math.max(1, Number(qty) || 1);

      if (qtyNum > stock) {
        toast.error(`Only ${stock} in stock for ${product.title || product.name}.`);
        return;
      }

      // reuse your existing add-to-cart logic
      handleAddtoCart(product._id || product.id, stock);
      toast.success(`Added ${qtyNum} × ${product.title || product.name}`);
    };

    window.addEventListener("voice-add-to-cart", onVoiceAdd);
    return () => window.removeEventListener("voice-add-to-cart", onVoiceAdd);
  }, [productList, cartItems, isAuthenticated, user]);

  useEffect(() => {
    setSort("price-lowtohigh");
    setFilters(JSON.parse(sessionStorage.getItem("filters")) || {});
  }, [categorySearchParam]);

  useEffect(() => {
    if (filters && Object.keys(filters).length > 0) {
      const createQueryString = createSearchParamsHelper(filters);
      setSearchParams(new URLSearchParams(createQueryString));
    }
  }, [filters, setSearchParams]);

  useEffect(() => {
    if (filters !== null && sort !== null)
      dispatch(
        fetchAllFilteredProducts({ filterParams: filters, sortParams: sort })
      );
  }, [dispatch, sort, filters]);

  useEffect(() => {
    if (productDetails !== null) setOpenDetailsDialog(true);
  }, [productDetails]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 p-4 md:p-6">
      {/* LEFT: Filter column in light grey card (sticky) */}
      <aside className="self-start">
        <div className="rounded-lg border border-border bg-gray-50 dark:bg-white/5 p-4 sticky top-24">
          <ProductFilter filters={filters} handleFilter={handleFilter} />
        </div>
      </aside>

      {/* RIGHT: Products card */}
      <div className="bg-background w-full rounded-lg shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-extrabold">All Products</h2>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {productList?.length} Products
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <ArrowUpDownIcon className="h-4 w-4" />
                  <span>Sort by</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuRadioGroup value={sort} onValueChange={handleSort}>
                  {sortOptions.map((sortItem) => (
                    <DropdownMenuRadioItem
                      value={sortItem.id}
                      key={sortItem.id}
                    >
                      {sortItem.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
          {productList && productList.length > 0
            ? productList.map((productItem) => (
                <div id={`product-${productItem._id}`} key={productItem._id}>
                  <ShoppingProductTile
                    handleGetProductDetails={handleGetProductDetails}
                    product={productItem}
                    handleAddtoCart={handleAddtoCart}
                  />
                </div>
              ))
            : null}
        </div>
      </div>

      {/* Footer spans full width */}
      <div className="md:col-span-2">
        <ShopFooter />
      </div>

      <ProductDetailsDialog
        open={openDetailsDialog}
        setOpen={setOpenDetailsDialog}
        productDetails={productDetails}
      />
    </div>
  );
}

export default ShoppingListing;