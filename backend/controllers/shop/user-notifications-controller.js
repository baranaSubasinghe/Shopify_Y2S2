// backend/controllers/shop/user-notifications-controller.js
const mongoose = require("mongoose");
const UserNotification = require("../../models/userNotification");

const uid = (u) => (u && (u._id || u.id)) || null;

exports.listMy = async (req, res) => {
  try {
    const userId = uid(req.user);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorised" });

    const items = await UserNotification
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: items });
  } catch (e) {
    console.error("[user-notifs] listMy", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markRead = async (req, res) => {
  try {
    const userId = uid(req.user);
    const { id }  = req.params;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorised" });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid id" });

    const n = await UserNotification.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: { isRead: true } },
      { new: true }
    ).lean();

    if (!n) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: n });
  } catch (e) {
    console.error("[user-notifs] markRead", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const userId = uid(req.user);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorised" });

    const r = await UserNotification.updateMany(
      { user: userId, isRead: { $ne: true } },
      { $set: { isRead: true } }
    );
    return res.json({ success: true, data: { matched: r.matchedCount, modified: r.modifiedCount } });
  } catch (e) {
    console.error("[user-notifs] markAllRead", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeOne = async (req, res) => {
  try {
    const userId = uid(req.user);
    const { id }  = req.params;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorised" });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid id" });

    const r = await UserNotification.deleteOne({ _id: id, user: userId });
    if (r.deletedCount === 0) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true });
  } catch (e) {
    console.error("[user-notifs] removeOne", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};