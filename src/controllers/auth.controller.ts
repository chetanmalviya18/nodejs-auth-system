import { Request, Response } from "express";
import userModel from "../models/user.model";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config";

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

  const accessToken = jwt.sign({ id: newUser._id }, config.JWT_SECRET, {
    expiresIn: "1d",
  });

  const refreshToken = jwt.sign({ id: newUser._id }, config.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    user: { username: newUser.username, email: newUser.email },
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
