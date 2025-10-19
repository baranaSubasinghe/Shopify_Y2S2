module.exports = function requireRole(...allowed) {
  return (req, res, next) => {
    try {
      const role = req.user?.role;
      if (!role) return res.status(401).json({ success: false, message: "Not authenticated" });
      if (!allowed.includes(role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
};