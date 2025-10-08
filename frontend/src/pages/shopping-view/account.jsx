// frontend/src/pages/shopping-view/account.jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import accImg from "@/assets/account.jpg";
import Address from "@/components/shopping-view/address";
import ShoppingOrders from "@/components/shopping-view/orders";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  changePassword,
  deleteMyAccount,
  fetchMe,
} from "@/store/account-slice";
import { logoutUser } from "@/store/auth-slice";

function ShoppingAccount() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { me } = useSelector((s) => s.account);

  // password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);

  const onSavePassword = async () => {
    if (!currentPassword || !newPassword)
      return toast.error("Fill both password fields.");
    if (newPassword !== confirm) return toast.error("New passwords do not match.");
    setSaving(true);
    try {
      await dispatch(changePassword({ currentPassword, newPassword })).unwrap();
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

 const onDeleteAccount = async () => {
    const ok = window.prompt('Type "DELETE" to confirm account removal') === "DELETE";
    if (!ok) return;
    setDeleting(true);
    try {
      await dispatch(deleteMyAccount()).unwrap();
     
      await dispatch(logoutUser());
      toast.success("Account deleted.");
     
      window.location.replace("/auth/login");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete account.");
    } finally {
    setDeleting(false);
    }
  };
  


  const safeDate = (ts) => {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "-" : d.toLocaleString();
    
  };

  return (
    <div className="flex flex-col w-screen min-h-screen">
    
      <div className="relative h-[300px] w-full overflow-hidden">
        <img src={accImg} className="h-full w-full object-cover object-center" />
      </div>

      {/* Content */}
      <div className="container mx-auto grid grid-cols-1 gap-8 py-8">
        <div className="flex flex-col rounded-lg border bg-background p-6 shadow-sm">
          <Tabs defaultValue="orders">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="address">Address</TabsTrigger>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="danger" className="text-red-600">
                  Danger Zone
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Orders */}
            <TabsContent value="orders" className="mt-6">
              <ShoppingOrders />
            </TabsContent>

            {/* Address */}
            <TabsContent value="address" className="mt-6">
              <Address />
            </TabsContent>

            {/* Profile (read-only info) */}
            <TabsContent value="profile" className="mt-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-lg border p-5">
                  <h3 className="mb-4 text-lg font-medium">My Profile</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      {me?.userName || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      {me?.email || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Role:</span>{" "}
                      {me?.role || "-"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Joined:</span>{" "}
                      {me?.createdAt ? safeDate(me.createdAt) : "-"}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-5">
                  <h3 className="mb-4 text-lg font-medium">Tips</h3>
                  <p className="text-sm text-muted-foreground">
                    Keep your email up to date and use a strong password. If you
                    need to change your password, go to the <b>Security</b> tab.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Add many addresses for easy ordering, go to the <b>Addresse</b> tab.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    If you want to delete your account, go to the <b>Addresse</b> tab.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Security (change password) */}
            <TabsContent value="security" className="mt-6">
              <div className="rounded-lg border p-5 max-w-xl">
                <h3 className="mb-4 text-lg font-medium">Change Password</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm mb-1">Current password</label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">New password</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">
                      Confirm new password
                    </label>
                    <Input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                  <div className="pt-1">
                    <Button onClick={onSavePassword} disabled={saving}>
                      {saving ? "Saving..." : "Save Password"}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Danger Zone (delete account) */}
            <TabsContent value="danger" className="mt-6">
              <div className="rounded-lg border p-5 max-w-xl">
                <h3 className="mb-3 text-lg font-medium text-red-600">
                  Danger Zone
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Deleting your account is permanent. This cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  onClick={onDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete my account"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default ShoppingAccount;
