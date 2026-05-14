import dotenv from "dotenv";

dotenv.config();

if (!process.env.PORT || !process.env.MONGODB_URI) {
  throw new Error("PORT and MONGODB_URI must be defined in .env file");
}

const config = {
  PORT: process.env.PORT,
  MONGO_URL: process.env.MONGODB_URI,
};

export default config;
