const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "cambia-esto";

function firmarToken(usuario) {
  return jwt.sign({ id: usuario.id, usuario: usuario.usuario }, SECRET, {
    expiresIn: "30d",
  });
}

function requiereAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Falta token de sesión" });
  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Sesión inválida o vencida" });
  }
}

module.exports = { firmarToken, requiereAuth };
