const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const { sendMail } = require("../../utils/email");



//register
const registerUser = async (req, res) => {
  const { userName, email, password } = req.body;

  try {
    const checkUser = await User.findOne({ email });
    if (checkUser)
      return res.json({
        success: false,
        message: "User Already exists with the same email! Please try again",
      });

    const hashPassword = await bcrypt.hash(password, 12);
    const newUser = new User({
      userName,
      email,
      password: hashPassword,
    });

    await newUser.save();
    res.status(200).json({
      success: true,
      message: "Registration successful",
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured",
    });
  }
};

//login
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
   const checkUser = await User.findOne({ email }).select("+password");
    if (!checkUser)
      return res.json({
        success: false,
        message: "User doesn't exists! Please register first",
      });

    const checkPasswordMatch = await bcrypt.compare(
      password,
      checkUser.password
    );
    if (!checkPasswordMatch)
      return res.json({
        success: false,
        message: "Incorrect password! Please try again",
      });

    const token = jwt.sign(
      {
        id: checkUser._id,
        role: checkUser.role,
        email: checkUser.email,
        userName: checkUser.userName,
      },
      "CLIENT_SECRET_KEY",
      { expiresIn: "60m" }
    );

    res.cookie("token", token, { httpOnly: true, secure: false }).json({
      success: true,
      message: "Logged in successfully",
      user: {
        email: checkUser.email,
        role: checkUser.role,
        id: checkUser._id,
        userName: checkUser.userName,
      },
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured",
    });
  }
};

//logout

const logoutUser = (req, res) => {
  res.clearCookie("token").json({
    success: true,
    message: "Logged out successfully!",
  });
};


const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user)
      return res.status(200).json({
        success: true,
        message: "If that email exists, a reset link was sent.",
      });

    const token = crypto.randomBytes(20).toString("hex");
    // after generating token
user.resetPasswordToken = token;
user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour, as Date
await user.save();

console.log("[forgot] saved token:", user.resetPasswordToken, "exp:", user.resetPasswordExpires);

    const resetUrl = `${process.env.APP_BASE_URL}/auth/reset-password?token=${token}&email=${email}`;

    const html = `
      <h2>Password Reset Request</h2>
      <p>Click below to reset your password:</p>
      <a href="${resetUrl}" target="_blank">${resetUrl}</a>
      <p>This link will expire in 1 hour.</p>
    `;

    await sendMail({
      to: user.email,
      subject: "Reset your password - Shopify",
      html,
      text: `Reset your password here: ${resetUrl}`,
    });

    res.json({
      success: true,
      message: "Password reset link sent to your email.",
    });
  } catch (error) {
    console.error("Forgot Password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// POST /api/auth/reset-password  { email, token, password }
const resetPassword = async (req, res) => {
  try {
    const { email, token, password } = req.body || {};
    if (!email || !token || !password) {
      return res.status(400).json({ success:false, message:"Missing fields (email, token, password)" });
    }
    if (password.length < 8) {
      return res.status(400).json({ success:false, message:"Password must be at least 8 characters" });
    }

    // single query: email match + token match + not expired
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+password +resetPasswordToken +resetPasswordExpires");

    if (!user) {
      // add dev hint so you know what failed
      const hint = process.env.NODE_ENV === "production" ? undefined : "Invalid email/token or token expired";
      return res.status(400).json({ success:false, message:"Invalid or expired token", _dbg: hint });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.json({ success:true, message:"Password updated" });
  } catch (err) {
    console.error("[reset] error:", err);
    const payload = { success:false, message:"Server error" };
    if (process.env.NODE_ENV !== "production") payload._dbg = err?.message || String(err);
    return res.status(500).json(payload);
  }
};
//auth middleware
const authMiddleware = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({
      success: false,
      message: "Unauthorised user!",
    });

  try {
    const decoded = jwt.verify(token, "CLIENT_SECRET_KEY");
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Unauthorised user!",
    });
  }
};

//admin midlware
// Ensure request comes from a logged-in ADMIN user
const adminOnly = async (req, res, next) => {
  try {
    // `authMiddleware` must run before this, so req.user.id should exist
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorised user!" });
    }

    const user = await User.findById(req.user.id).select("isAdmin role");
    const isAdmin = user && (user.isAdmin === true || user.role === "admin");

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Admins only." });
    }

    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};


module.exports = { registerUser, loginUser, logoutUser, authMiddleware ,adminOnly, forgotPassword, resetPassword};
