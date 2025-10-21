// backend/helpers/notify.js
const mongoose = require("mongoose");

function loadModel() {
  try {
    // ✅ match the actual filename's casing
    return require("../models/userNotification");
  } catch (e1) {
    try {
      // fallback if your file really is lowercased
      return require("../models/userNotification");
    } catch (e2) {
      console.warn("[notify] UserNotification model not found; will only log.");
      return null;
    }
  }
}
const UserNotification = loadModel();

function toOid(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  const s = String(id);
  return mongoose.isValidObjectId(s) ? new mongoose.Types.ObjectId(s) : null;
}

/**
 * Create a user notification row (safe).
 * @returns {Promise<{ok:boolean, id?:string, mock?:boolean, reason?:string}>}
 */
async function notifyUser(userId, type, title, message, meta = {}) {
  const user = toOid(userId);
  if (!user) {
    console.warn("[notify] skipped: invalid user id", { userId });
    return { ok: false, reason: "invalid_user" };
  }

  const payload = {
    user,
    type: String(type || "INFO").toUpperCase(),
    title: String(title || "").trim() || "Notification",
    message: String(message || "").trim(),
    meta,
    isRead: false,
    createdAt: new Date(), // fine even if schema has timestamps
  };

  if (!UserNotification) {
    console.log("[notify] (no model) would create:", payload);
    return { ok: true, mock: true };
  }

  try {
    const doc = await UserNotification.create(payload);
    return { ok: true, id: String(doc._id) };
  } catch (err) {
    console.warn("[notify] create failed:", err?.message || err);
    return { ok: false, reason: "db_error" };
  }
}

module.exports = { notifyUser };