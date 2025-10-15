import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendReset() {
    if (!email) return toast.error("Enter your email address");
    setLoading(true);
    try {
      console.log("[forgot] sending for:", email);
      const { data } = await axios.post("http://localhost:5001/api/auth/forgot-password", { email });
      toast.success(data?.message || "If that email exists, we sent a link.");
      // dev helper: open link immediately if backend includes it
      if (data?.resetUrl) {
        try { await navigator.clipboard.writeText(data.resetUrl); } catch {}
        window.location.href = data.resetUrl;
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Error sending reset link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <h1 className="text-2xl font-bold text-center">Forgot Password</h1>

      {/* no <form> => no browser submit/refresh */}
      <input
        type="email"
        className="w-full border rounded p-2"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button
        onClick={sendReset}
        disabled={loading}
        className="w-full bg-primary text-white py-2 rounded hover:bg-primary/80"
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </button>
    </div>
  );
}