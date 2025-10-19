// backend/controllers/admin/notifications-controller.js
const Notification = require("../../models/Notification");

exports.list = async (req, res) => {
  try {
    const page  = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip  = (page - 1) * limit;

    const [items, total, unread] = await Promise.all([
      Notification.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({}),
      Notification.countDocuments({ isRead: false }),
    ]);

    return res.json({
      success: true,
      data: items,       // <-- keep existing field so your FE keeps working
      total,             // <-- new
      unread,            // <-- new
      page,
      limit,
    });
  } catch (e) {
    console.error("[notif] list error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const n = await Notification.findByIdAndUpdate(
      id,
      { $set: { isRead: true } },
      { new: true }
    );
    if (!n) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: n });
  } catch (e) {
    console.error("[notif] markRead error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markAllRead = async (_req, res) => {
  try {
    await Notification.updateMany({ isRead: false }, { $set: { isRead: true } });
    return res.json({ success: true });
  } catch (e) {
    console.error("[notif] markAllRead error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const del = await Notification.findByIdAndDelete(id);
    if (!del) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true });
  } catch (e) {
    console.error("[notif] remove error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};