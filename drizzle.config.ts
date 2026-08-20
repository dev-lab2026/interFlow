import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    host: process.env.SQL_HOST || "interflow-postgres",
    user: process.env.SQL_USER || "interflow",
    password: process.env.SQL_PASSWORD || "",
    database: process.env.SQL_DB_NAME || "interflow",
    port: Number(process.env.SQL_PORT || 5432),
    ssl: false,
  },
  verbose: true,
});
