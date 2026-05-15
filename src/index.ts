import express from "express";
import config from "./config";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import connectDB from "./config/db";
import authRouter from "./routes/auth.routes";

const app = express();

app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

app.use("/api/auth", authRouter);

app.get("/", (req, res) => {
  res.send("Hello from authentication system server!");
});

connectDB();

app.listen(config.PORT, () => {
  console.log(`Server is running on port ${config.PORT}`);
});
