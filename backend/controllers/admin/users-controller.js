// backend/controllers/admin/users-controller.js
const User = require("../../models/User");

// helper
async function isLastAdmin(userId) {
  const count = await User.countDocuments({ role: "admin" });
  if (count > 1) return false;
  // if only one admin remains, check if that admin is the same user
  const me = await User.findById(userId).select("_id role");
  return me && me.role === "admin" && count === 1;
}

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 50 } = req.query;
    const q = (search || "").trim();

    const filter = q
      ? {
          $or: [
            { userName: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("_id userName email role createdAt"),
      User.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { items, total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    console.error("getAllUsers error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // don't allow deleting yourself
    if (req.user && String(req.user.id || req.user._id) === String(id)) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot delete your own account." });
    }

    // don't allow deleting the last admin
    if (await isLastAdmin(id)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete the last admin.",
      });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.json({ success: true, message: "User deleted." });
  } catch (err) {
    console.error("deleteUserById error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/users/:id/role  { role: "admin"|"user" } OR { newRole: "admin"|"user" }
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const incoming = req.body?.role || req.body?.newRole;
    const nextRole = typeof incoming === "string" ? incoming.toLowerCase() : "";

    if (!["admin", "user"].includes(nextRole)) {
      return res.status(400).json({ success: false, message: "Invalid role value." });
    }

    const requesterId = String(req.user?.id || req.user?._id || "");
    const sameUser = requesterId && requesterId === String(id);

    // Safety: don't let the last admin demote themself
    if (sameUser && nextRole === "user" && (await isLastAdmin(id))) {
      return res.status(400).json({
        success: false,
        message: "You are the last admin. Create another admin before demoting yourself.",
      });
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: { role: nextRole } },
      { new: true, runValidators: true, select: "_id userName email role createdAt" }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("updateUserRole error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
