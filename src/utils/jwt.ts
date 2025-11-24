import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION as string;
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY as string;
const REFRESH_JWT_SECRET = process.env.REFRESH_JWT_SECRET as string;

export const generateAccessToken = (payload: { userId: string; email: string }) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};


export const generateRefreshToken = (payload: {
  userId: string;
  email: string;
}) => {
  return jwt.sign(payload, REFRESH_JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};


