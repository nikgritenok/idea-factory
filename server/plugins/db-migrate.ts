import { migrateUp, getSql } from "../db/migrate";

export default defineNitroPlugin(async () => {
  if (process.env.RUN_MIGRATIONS !== "true") return;
  const applied = await migrateUp(getSql());
  if (applied.length) console.log("[db] applied migrations:", applied);
});
