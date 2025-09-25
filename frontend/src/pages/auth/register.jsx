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
function AuthRegister() {
  const [formData, setFormData] = useState(initialState);
  const dispatch = useDispatch();
  const navigate = useNavigate();
//  const { toast } = useToast();

  function onSubmit(event) {
   event.preventDefault();
    //dispatch(registerUser(formData)).then((data) => {
      // basic client-side checks
  if (!formData.userName || !formData.email || !formData.password || !formData.confirmPassword) {
   toast.error("Please fill in all fields.");
    return;
  }
  if (formData.password !== formData.confirmPassword) {
    toast.error("Passwords do not match.");
    return;
  }

 // send only the fields your backend expects
 const payload = {
    userName: formData.userName,
    email: formData.email,
    password: formData.password,
  };

  dispatch(registerUser(payload)).then((data) => {
      if (data?.payload?.success) {
        toast.success(data?.payload?.message || "Registration successful!");
      navigate("/auth/login");
        navigate("/auth/login");
      } else {
       toast.error(data?.payload?.message || "Something went wrong!");
      }
    }); 
  }

  console.log(formData);

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
