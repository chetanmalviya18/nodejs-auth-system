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

  const token = jwt.sign({ id: newUser._id }, config.JWT_SECRET, {
    expiresIn: "1d",
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    user: { username: newUser.username, email: newUser.email },
    token,
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

  if (typeof decode === 'string' || !('id' in decode)) {
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
