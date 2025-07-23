import jwt from "jsonwebtoken";

const userAuth = async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Login again.",
    });
  }

  try {
    const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {id: tokenDecode.id};
    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export default userAuth;
