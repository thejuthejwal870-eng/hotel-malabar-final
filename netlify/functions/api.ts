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
  // Always load the latest valid database from Supabase first.
  await syncFromSupabase();

  // Reload the database instance from /tmp.
  const { db } = await import("../../server/db.ts");
  db.reloadFromFile();

  const appHandler = await getHandler();
  const result = await appHandler(event, context);

  const method = String(event?.httpMethod || "").toUpperCase();

  // Persist every database-changing request before the Lambda finishes.
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const saved = await syncToSupabase();

    if (!saved) {
      console.error("CRITICAL: Database change was not saved to Supabase.");

      return {
        ...result,
        statusCode: 503,
        body: JSON.stringify({
          error: "Database save failed. Please try again.",
        }),
        headers: {
          ...(result?.headers || {}),
          "Content-Type": "application/json",
        },
      };
    }
  }

  return result;
};
