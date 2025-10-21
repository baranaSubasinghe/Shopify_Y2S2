// backend/controllers/user/account-controller.js
const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const { notifyUser } = require("../../helpers/notify"); // ✅ add this

const getReqUserId = (req) => String(req.user?._id || req.user?.id || ""); // ✅ handle _id or id

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

// PATCH /api/user/account/password
// body: { currentPassword, newPassword, confirmPassword? }
// PATCH /api/user/account/password
// accepts body keys: currentPassword | oldPassword, newPassword | password, optional confirmPassword
exports.changePassword = async (req, res) => {
  // tiny helper to log + respond consistently
  const fail = (status, code, message, extra = {}) => {
    console.warn(`[account][changePassword] ${code}`, extra);
    return res.status(status).json({ success: false, code, message });
  };

  try {
    const userId = String(req.user?._id || req.user?.id || "");
    if (!userId) return fail(401, "UNAUTHORIZED", "Unauthorized.");

    // accept multiple field names just in case
    const {
      currentPassword,
      oldPassword,
      newPassword,
      password: newPasswordAlt,
      confirmPassword,
    } = req.body || {};

    const curr = currentPassword ?? oldPassword;
    const next = newPassword ?? newPasswordAlt;

    console.log("[account][changePassword] body keys", {
      haveCurrent: !!curr,
      haveNew: !!next,
      haveConfirm: !!confirmPassword,
      contentType: req.get("content-type"),
    });

    if (!curr || !next) {
      return fail(400, "MISSING_FIELDS",
        "Both currentPassword (or oldPassword) and newPassword (or password) are required.",
        { haveCurrent: !!curr, haveNew: !!next }
      );
    }

    if (confirmPassword && next !== confirmPassword) {
      return fail(400, "MISMATCH", "Passwords do not match.");
    }

    if (String(next).length < 8) {
      return fail(400, "TOO_SHORT", "New password must be at least 8 characters.", {
        providedLength: String(next).length,
      });
    }

    // include password even if schema marks it select:false
    const user = await User.findById(userId).select("+password role email userName");
    if (!user) return fail(404, "NOT_FOUND", "User not found.");

    if (!user.password) {
      return fail(500, "NO_PASSWORD_FIELD", "Password field missing on user document.");
    }

    const currentOk = await bcrypt.compare(String(curr), String(user.password));
    if (!currentOk) {
      return fail(400, "BAD_CURRENT", "Current password is incorrect.");
    }

    // block same-as-old
    const sameAsOld = await bcrypt.compare(String(next), String(user.password));
    if (sameAsOld) {
      return fail(400, "SAME_AS_OLD", "New password can’t be the same as current.");
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(String(next), salt);
    await user.save();

    // non-blocking notification
    try {
      await notifyUser(
        user._id,
        "SECURITY",
        "Password changed",
        "Your account password was changed. If this wasn’t you, reset it immediately.",
        { ip: req.ip, ua: req.get("user-agent"), at: new Date().toISOString() }
      );
    } catch (e) {
      console.warn("[account][changePassword] notify failed:", e?.message || e);
    }

    console.log("[account][changePassword] OK", { userId: String(user._id) });
    return res.json({ success: true, message: "Password updated." });
  } catch (e) {
    console.error("changePassword error:", e);
    return res.status(500).json({ success: false, code: "SERVER_ERROR", message: "Server error." });
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

    // ✅ clear cookie where it was set (usually path: "/")
    res
      .clearCookie(process.env.AUTH_COOKIE_NAME || "token", {
        httpOnly: true,
        sameSite: "lax",
        path: "/", // ← changed from "/login"
      })
      .status(200)
      .json({ success: true, message: "Account deleted." });
  } catch (e) {
    console.error("deleteMe error:", e);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/user/account/password/ping
exports.passwordPing = (req, res) => {
  const id = getReqUserId(req);
  if (!id) return res.status(401).json({ success: false, message: "Unauthorized." });
  return res.json({ success: true, message: "Password route OK", userId: id });
};