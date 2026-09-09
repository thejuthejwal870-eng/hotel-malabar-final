import serverless from "serverless-http";
import { syncFromSupabase, syncToSupabase } from "../../server/supabase-sync.ts";

let appHandlerPromise: Promise<any> | null = null;

async function getHandler() {
  if (!appHandlerPromise) {
    const { app } = await import("../../server.ts");
    appHandlerPromise = Promise.resolve(serverless(app));
  }

  return appHandlerPromise;
}

export const handler = async (event: any, context: any) => {
  // Always load the latest database from Supabase before handling a request.
  await syncFromSupabase();

  // Refresh the already-loaded database instance from /tmp.
  const { db } = await import("../../server/db.ts");
  db.reloadFromFile();

  const appHandler = await getHandler();
  const result = await appHandler(event, context);

  // Save only requests that can actually change database data.
  const method = String(event?.httpMethod || "").toUpperCase();

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    await syncToSupabase();
  }

  return result;
};
