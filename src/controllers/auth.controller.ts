import { Request, Response } from "express";
import userModel from "../models/user.model";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config";
import sessionModel from "../models/session.model";
import { sendEmail } from "../services/email.service";
import { generateOtp, otpHtml } from "../utils/utils";
import otpModel from "../models/otp.model";

export async function register(req: Request, res: Response) {
  const { username, email, password } = req.body;

  const isExistingUser = await userModel.findOne({
    $or: [{ username }, { email }],
  });

  if (isExistingUser) {
    return res.status(409).json({
      success: false,
      message: "Username or email already exists",
    });
  }

  const hasedPassword = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  const newUser = await userModel.create({
    username,
    email,
    password: hasedPassword,
  });

  const otp = generateOtp();
  const html = otpHtml(otp);

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  await otpModel.create({
    email: newUser.email,
    user: newUser._id,
    otpHash,
  });

  await sendEmail(email, "Verify your email", `Your OTP is: ${otp}`, html);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    user: {
      username: newUser.username,
      email: newUser.email,
      verified: newUser.verified,
    },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  if (!user.verified) {
    return res.status(403).json({
      success: false,
      message: "Email not verified",
    });
  }

  const hashedPassword = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  if (user.password !== hashedPassword) {
    return res.status(401).json({
      success: false,
      message: "Invalid password",
    });
  }

  const refreshToken = jwt.sign({ id: user._id }, config.JWT_SECRET, {
    expiresIn: "7d",
  });

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await sessionModel.create({
    user: user._id,
    refreshTokenHash,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "unknown",
  });

  const accessToken = jwt.sign(
    { id: user._id, sessionId: session._id },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    user: { username: user.username, email: user.email },
    accessToken,
  });
}

export async function getMe(req: Request, res: Response) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  const decode = jwt.verify(token, config.JWT_SECRET);

  if (typeof decode === "string" || !("id" in decode)) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  const user = await userModel.findById(decode.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "User found",
    user: { username: user.username, email: user.email },
  });
}

export async function refreshToken(req: Request, res: Response) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: "No refresh token provided",
    });
  }

  const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await sessionModel.findOne({
    refreshTokenHash,
    revoked: false,
  });

  if (!session) {
    return res.status(400).json({
      success: false,
      message: "Invalid refresh token",
    });
  }

  if (typeof decoded === "string" || !("id" in decoded)) {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }

  const user = await userModel.findById(decoded.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  const newRefreshToken = jwt.sign({ id: user._id }, config.JWT_SECRET, {
    expiresIn: "7d",
  });

  const newRefreshTokenHash = crypto
    .createHash("sha256")
    .update(newRefreshToken)
    .digest("hex");

  session.refreshTokenHash = newRefreshTokenHash;
  await session.save();

  const newAccessToken = jwt.sign({ id: user._id }, config.JWT_SECRET, {
    expiresIn: "15m",
  });

  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: "Access token refreshed successfully",
    accessToken: newAccessToken,
  });
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: "No refresh token provided",
    });
  }

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await sessionModel.findOne({
    refreshTokenHash,
    revoked: false,
  });

  if (!session) {
    return res.status(400).json({
      success: false,
      message: "Invalid refresh token",
    });
  }

  session.revoked = true;
  await session.save();

  res.clearCookie("refreshToken");

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}

export async function logoutAll(req: Request, res: Response) {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: "No refresh token provided",
    });
  }

  const decode = jwt.verify(refreshToken, config.JWT_SECRET);

  if (typeof decode === "string" || !("id" in decode)) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  await sessionModel.updateMany(
    {
      user: decode.id,
      revoked: false,
    },
    {
      revoked: true,
    },
  );

  res.clearCookie("refreshToken");

  res.status(200).json({
    success: true,
    message: "Logged out from all sessions successfully",
  });
}

export async function verifyEmail(req: Request, res: Response) {
  const { email, otp } = req.body;

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  const otpRecord = await otpModel.findOne({ email, otpHash });

  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP",
    });
  }

  const user = await userModel.findByIdAndUpdate(otpRecord.user, {
    verified: true,
  });

  await otpModel.deleteMany({
    user: otpRecord.user,
  });

  res.status(200).json({
    success: true,
    message: "Email verified successfully",
    user: { username: user?.username, email: user?.email, verified: true },
  });
}
