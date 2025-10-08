// backend/controllers/user/account-controller.js
const bcrypt = require("bcryptjs");
const User = require("../../models/User");

const getReqUserId = (req) => String(req.user?.id || "");

// Safety: do not allow removing the last admin account
async function isLastAdmin(userId) {
  const count = await User.countDocuments({ role: "admin" });
  if (count > 1) return false;
  const me = await User.findById(userId).select("_id role");
  return !!(me && me.role === "admin" && count === 1);
}

// GET /api/user/account/me
exports.getMe = async (req, res) => {
  try {
    const id = getReqUserId(req);
    if (!id) return res.status(401).json({ success: false, message: "Unauthorized." });
    const me = await User.findById(id).select("_id userName email role createdAt");
    if (!me) return res.status(404).json({ success: false, message: "User not found." });
    res.json({ success: true, data: me });
  } catch (e) {
    console.error("getMe error:", e);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/user/account/password  { currentPassword, newPassword }
exports.changePassword = async (req, res) => {
  try {
    const id = getReqUserId(req);
    if (!id) return res.status(401).json({ success: false, message: "Unauthorized." });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: "Both current and new password are required." });

    if (String(newPassword).length < 6)
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });

    // IMPORTANT: include password
    const user = await User.findById(id).select("+password role");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    if (!user.password) {
      return res.status(500).json({ success: false, message: "Password field missing on user document." });
    }

    const ok = await bcrypt.compare(String(currentPassword), String(user.password));
    if (!ok) return res.status(400).json({ success: false, message: "Current password is incorrect." });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(String(newPassword), salt);
    await user.save();

    res.json({ success: true, message: "Password updated." });
  } catch (e) {
    console.error("changePassword error:", e);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/user/account/me
exports.deleteMe = async (req, res) => {
  try {
    const id = getReqUserId(req);
    if (!id) return res.status(401).json({ success: false, message: "Unauthorized." });

    if (await isLastAdmin(id)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete the last admin. Transfer admin rights first.",
      });
    }

await User.findByIdAndDelete(id);
res
  .clearCookie(process.env.AUTH_COOKIE_NAME || "token", { httpOnly: true, sameSite: "lax", path: "/login" })
  .status(200)
  .json({ success: true, message: "Account deleted." });
  } catch (e) {
    console.error("deleteMe error:", e);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Simple ping to verify PATCH + auth works
// GET /api/user/account/password/ping
exports.passwordPing = (req, res) => {
  const id = getReqUserId(req);
  if (!id) return res.status(401).json({ success: false, message: "Unauthorized." });
  return res.json({ success: true, message: "Password route OK", userId: id });
};
