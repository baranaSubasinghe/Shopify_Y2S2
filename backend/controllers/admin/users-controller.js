const mongoose = require("mongoose");
const User = require("../../models/User");
const Order = require("../../models/Order");

// --- helpers ---
async function isLastAdmin(userId) {
  // how many admins exist?
  const count = await User.countDocuments({ role: "admin" });
  if (count > 1) return false;
  // if only one admin remains, is that the same user?
  const me = await User.findById(userId).select("_id role");
  return !!me && me.role === "admin" && count === 1;
}

// GET /api/admin/users/stats
exports.getUserStats = async (_req, res) => {
  try {
    const byRole = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const map = Object.fromEntries(byRole.map(r => [String(r._id || "").toLowerCase(), r.count]));
    const admins   = map.admin   || 0;
    const delivery = map.delivery|| 0;
    const users    = map.user    || 0;
    const total    = admins + delivery + users;

    return res.json({
      success: true,
      data: { total, admins, delivery, users }
    });
  } catch (err) {
    console.error("getUserStats error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
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

    // ⚠️ keep the same response shape your UI expects
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

// PATCH /api/admin/users/:id/role
// Body: { role: "admin" | "delivery" | "user" }  (or { newRole: ... })
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const incoming = req.body?.role || req.body?.newRole;
    const nextRole = typeof incoming === "string" ? incoming.toLowerCase() : "";

    // ✅ now supports "delivery" as well
    const ALLOWED = new Set(["admin", "delivery", "user"]);
    if (!ALLOWED.has(nextRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role value. Use one of: admin, delivery, user.",
      });
    }

    const requesterId = String(req.user?.id || req.user?._id || "");
    const isSelf = requesterId && requesterId === String(id);

    // Safety: don't let the last admin demote themself to delivery/user
    if (isSelf && nextRole !== "admin" && (await isLastAdmin(id))) {
      return res.status(400).json({
        success: false,
        message:
          "You are the last admin. Create another admin before changing your own role.",
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

    // ⚠️ keep the same response shape your UI expects
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("updateUserRole error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
// GET /api/admin/users/summary
// returns { total, admin, delivery, user }
exports.getUsersSummary = async (_req, res) => {
  try {
    const User = require("../../models/User");
    const grouped = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const out = { total: 0, admin: 0, delivery: 0, user: 0 };
    for (const g of grouped) {
      const key = String(g._id || "user").toLowerCase();
      if (key === "admin") out.admin = g.count;
      else if (key === "delivery") out.delivery = g.count;
      else out.user += g.count; // treat anything else as "user"
      out.total += g.count;
    }

    return res.json({ success: true, data: out });
  } catch (err) {
    console.error("getUsersSummary error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
exports.getActiveDeliveryStaff = async (req, res) => {
  try {
    const days  = Math.max(1, Math.min(Number(req.query.days)  || 30, 180));
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 8,  50));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const deliveredStates     = ["DELIVERED", "delivered"];
    const nearDeliveredStates = ["OUT_FOR_DELIVERY", "out_for_delivery", "SHIPPED", "shipped"];

    // Where the delivery user might be stored
    const idPaths = [
      "assignedTo",
      "assignedUserId",
      "deliveryUserId",
      "deliveryId",
      "deliveryPersonId",
      "deliveryBy",
      "delivery.assignedTo",
      "delivery.userId",
      "delivery.acceptedBy",
    ];

    // choose first non-null of the above
    const coalescePaths = (paths) => ({
      $let: {
        vars: { vals: paths.map(p => ({ $ifNull: [ `$${p}`, null ] })) },
        in: {
          $first: {
            $filter: { input: "$$vals", as: "v", cond: { $ne: ["$$v", null] } }
          }
        }
      }
    });

    const resolvedDateExpr = {
      $ifNull: [
        "$orderUpdateDate",
        { $ifNull: ["$updatedAt", "$orderDate"] }
      ]
    };

    // Build a generic pipeline that can target several statuses
    const buildPipeline = (allowedStatuses) => {
      const chosenIdExpr = coalescePaths(idPaths);         // could be ObjectId or string
      const chosenIdStr  = { $toString: chosenIdExpr };    // normalize to string key for grouping

      return [
        { $match: { orderStatus: { $in: allowedStatuses } } },
        { $addFields: { _ts: resolvedDateExpr } },
        { $match: { _ts: { $gte: since } } },

        // Get a string key, drop empty/ "null"
        { $addFields: { _deliveryKey: chosenIdStr } },
        { $match: { _deliveryKey: { $nin: [null, "", "null", "undefined"] } } },

        // Group by the normalized string key
        { $group: {
            _id: "$_deliveryKey",
            lastDeliveredAt: { $max: "$_ts" },
            deliveredCount:  { $sum: 1 },
          }
        },
        { $sort: { lastDeliveredAt: -1 } },
        { $limit: limit },

        // Try to lookup the user by comparing string(_id) with our string key
        { $lookup: {
            from: "users",
            let: { key: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: [ { $toString: "$_id" }, "$$key" ] } } },
              { $project: { _id: 1, userName: 1, email: 1, role: 1, avatar: 1 } }
            ],
            as: "user"
          }
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        { $match: { $or: [ { "user.role": "delivery" }, { user: { $eq: null } } ] } }, // allow unknowns

        // Final shape
        { $project: {
            _id: 0,
            key: "$_id",
            deliveredCount: 1,
            lastDeliveredAt: 1,
            user: 1
          }
        }
      ];
    };

    // 1) Strictly delivered
    let rows = await Order.aggregate(buildPipeline(deliveredStates));

    // 2) If empty, also accept near-delivered states
    if (!rows.length) {
      rows = await Order.aggregate(buildPipeline(deliveredStates.concat(nearDeliveredStates)));
    }

    // 3) If still empty, list delivery users as fallback
    if (!rows.length) {
      const fallbackUsers = await User.find({ role: "delivery" })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .select("_id userName email role avatar createdAt updatedAt")
        .lean();

      rows = fallbackUsers.map((u) => ({
        key: String(u._id),
        deliveredCount: 0,
        lastDeliveredAt: u.updatedAt || u.createdAt || since,
        user: u,
      }));
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getActiveDeliveryStaff error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};