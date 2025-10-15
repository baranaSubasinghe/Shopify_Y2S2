import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const token = sp.get("token") || "";
  const email = sp.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

const api = import.meta.env.VITE_API_URL || "http://localhost:5001";
async function submit() {
  if (!token || !email) return toast.error("Invalid reset link.");
  if (password.length < 8) return toast.error("Password must be at least 8 chars.");
  if (password !== confirm) return toast.error("Passwords do not match.");

  setLoading(true);
  try {
    const { data } = await axios.post(`${api}/api/auth/reset-password`, {
      email: (email || "").toLowerCase(),
      token,
      password
    });
    if (data.success) {
      toast.success("Password updated. Please sign in.");
      navigate("/auth/login");
    } else {
      toast.error(data.message || "Failed to reset.");
    }
  } catch (e) {
    const msg = e?.response?.data?.message || "Failed to reset.";
    const dbg = e?.response?.data?._dbg;
    toast.error(dbg ? `${msg} — ${dbg}` : msg);
  } finally {
    setLoading(false);
  }
}

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <h1 className="text-2xl font-bold text-center">Reset Password</h1>
      <input className="w-full border rounded p-2 bg-gray-100" value={email} readOnly />
      <input className="w-full border rounded p-2" type="password" placeholder="New password"
             value={password} onChange={(e)=>setPassword(e.target.value)} />
      <input className="w-full border rounded p-2" type="password" placeholder="Confirm new password"
             value={confirm} onChange={(e)=>setConfirm(e.target.value)} />
      <button onClick={submit} disabled={loading}
              className="w-full bg-primary text-white py-2 rounded hover:bg-primary/80">
        {loading ? "Saving..." : "Set new password"}
      </button>
      {!token || !email ? <p className="text-red-600 text-sm">Invalid or missing token.</p> : null}
    </div>
  );
}