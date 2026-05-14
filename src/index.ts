import express from "express";
import config from "./config";
import morgan from "morgan";
import connectDB from "./config/db";

const app = express();

app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.send("Hello from authentication system server!");
});

connectDB();

app.listen(config.PORT, () => {
  console.log(`Server is running on port ${config.PORT}`);
});
