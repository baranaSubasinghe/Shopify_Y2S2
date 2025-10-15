import CommonForm from "@/components/common/form";
import { loginFormControls } from "@/config";
import { loginUser } from "@/store/auth-slice";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

const initialState = { email: "", password: "" };

// same email regex as register
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthLogin() {
  const [formData, setFormData] = useState(initialState);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // optional: grab role from store if already populated after login
  const { user } = useSelector((s) => s.auth);

  async function onSubmit(event) {
    event.preventDefault();

    const email = (formData.email || "").trim().toLowerCase();
    const password = formData.password || "";

    if (!emailRe.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!password) {
      toast.error("Password is required.");
      return;
    }

    const res = await dispatch(loginUser({ email, password }));

    if (res?.payload?.success) {
      toast.success(res?.payload?.message || "Login successful!");

      // figure out where to go:
      const from = location.state?.from?.pathname; // where the guard sent us from
      const roleFromPayload = res?.payload?.data?.user?.role;
      const role = roleFromPayload || user?.role;

      const fallback =
        role === "admin" ? "/admin/dashboard" : "/shop/home";

      navigate(from || fallback, { replace: true });
    } else {
      toast.error(res?.payload?.message || "Login failed!");
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Sign in to your account
        </h1>
        <p className="mt-2">
          Don't have an account
          <Link
            className="font-medium ml-2 text-primary hover:underline"
            to="/auth/register"
          >
            Register
          </Link>
        </p>
      </div>

      <CommonForm
        formControls={loginFormControls}
        buttonText="Sign In"
        formData={formData}
        setFormData={setFormData}
        onSubmit={onSubmit}
      />

      <p className="text-sm mt-2 text-center">
        <Link to="/auth/forgot-password" className="underline text-primary">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}

export default AuthLogin;