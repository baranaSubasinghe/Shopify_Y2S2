import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminReviews,
  deleteAdminReview,
  setReviewsSearch,
} from "@/store/admin/reviews-slice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { generateReviewsPDF } from "@/utils/pdf/reviewsReport";

export default function AdminReviewsPage() {
  const dispatch = useDispatch();
  const { items, status, search } = useSelector((s) => s.adminReviews);

  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    dispatch(fetchAdminReviews({ search }));
  }, [dispatch, search]);

  const onSearch = () => {
    dispatch(setReviewsSearch(localSearch.trim()));
  };

  const onDelete = async (id) => {
    const ok = confirm("Delete this review?");
    if (!ok) return;
    const res = await dispatch(deleteAdminReview(id));
    if (res.payload?.success) toast.success("Review deleted");
    else toast.error(res.payload?.message || "Delete failed");
  };

  const onDownload = () => {
    generateReviewsPDF(items || []);
  };

  const busy = status === "loading";

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">Product Reviews</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Search by product or user..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={onSearch} disabled={busy}>Search</Button>
          <Button variant="secondary" onClick={() => { setLocalSearch(""); dispatch(setReviewsSearch("")); }} disabled={busy}>
            Clear
          </Button>
          <Button onClick={onDownload} disabled={busy || !items?.length}>
            Download PDF
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items || []).map((r) => (
              <TableRow key={r._id}>
                <TableCell className="font-medium">{r.productTitle || "(deleted product)"}</TableCell>
                <TableCell>{r.userName || "-"}</TableCell>
                <TableCell>{r.reviewValue ?? "-"}</TableCell>
                <TableCell className="max-w-[360px]">
                  <span title={r.reviewMessage}>{(r.reviewMessage || "").slice(0, 100)}</span>
                </TableCell>
                <TableCell>{new Date(r.createdAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(r._id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!busy && (!items || items.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No reviews found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
