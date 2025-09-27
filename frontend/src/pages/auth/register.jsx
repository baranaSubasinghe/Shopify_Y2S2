import CommonForm from "@/components/common/form";
import { registerFormControls } from "@/config";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "@/store/auth-slice";
import { useState } from "react";
import { toast } from "sonner";

const initialState = {
  userName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

// regex rules
const nameOnlyLetters = /^[A-Za-z\s]+$/; // letters + spaces only
const strongPassword =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,72}$/; // 8-72, upper, lower, number, symbol
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // proper email format

function AuthRegister() {
  const [formData, setFormData] = useState(initialState);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  async function onSubmit(event) {
    event.preventDefault();

    const userName = (formData.userName || "").trim();
    const email = (formData.email || "").trim().toLowerCase();
    const password = formData.password || "";
    const confirmPassword = formData.confirmPassword || "";

    // presence checks
    if (!userName || !email || !password || !confirmPassword) {
      toast.error("Please fill in all fields.");
      return;
    }

    // username validations
    if (userName.length < 2 || userName.length > 50) {
      toast.error("User name must be 2–50 characters.");
      return;
    }
    if (!nameOnlyLetters.test(userName)) {
      toast.error("User name can contain only letters and spaces.");
      return;
    }

    // email
    if (!emailRe.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }

    // password
    if (!strongPassword.test(password)) {
      toast.error("Password must be 8+ chars and include upper, lower, number, and symbol.");
      return;
    }

    // confirm
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    // payload (send only what backend expects)
    const payload = { userName, email, password };

    const res = await dispatch(registerUser(payload));
    if (res?.payload?.success) {
      toast.success(res?.payload?.message || "Registration successful!");
      navigate("/auth/login");
    } else {
      toast.error(res?.payload?.message || "Something went wrong!");
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Create new account
        </h1>
        <p className="mt-2">
          Already have an account
          <Link
            className="font-medium ml-2 text-primary hover:underline"
            to="/auth/login"
          >
            Login
          </Link>
        </p>
      </div>
      <CommonForm
        formControls={registerFormControls}
        buttonText={"Sign Up"}
        formData={formData}
        setFormData={setFormData}
        onSubmit={onSubmit}
      />
    </div>
  );
}

export default AuthRegister;
