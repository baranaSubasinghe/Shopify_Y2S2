const User = require("../../models/User");

// GET /api/admin/users?search=barana&page=1&limit=20
exports.getAllUsers = async (req, res) => {
  const { search = "", page = 1, limit = 50 } = req.query;
  const q = search.trim();
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
     .select("userName email createdAt") // keep it explicit
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(), // plain JSON (no mongoose getters)
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { items, total, page: Number(page), limit: Number(limit) },
  });
};

// DELETE /api/admin/users/:id
exports.deleteUserById = async (req, res) => {
  const { id } = req.params;

  // (optional) prevent self-delete
  if (req.user && req.user.id === id) {
    return res
      .status(400)
      .json({ success: false, message: "You cannot delete your own account." });
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    return res
      .status(404)
      .json({ success: false, message: "User not found." });
  }
  res.json({ success: true, message: "User deleted." });
};
