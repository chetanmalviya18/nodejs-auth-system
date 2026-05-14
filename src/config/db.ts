import mongoose from "mongoose";
import config from ".";

async function connectDB() {
  await mongoose.connect(config.MONGO_URL!);

  console.log("Connected to db");
}

export default connectDB;
