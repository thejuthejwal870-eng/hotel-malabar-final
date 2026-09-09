import serverless from "serverless-http";
import { syncFromSupabase, syncToSupabase } from "../../server/supabase-sync.ts";

let appHandlerPromise: Promise<any> | null = null;

async function getHandler() {
  if (!appHandlerPromise) {
    await syncFromSupabase();

    const { app } = await import("../../server.ts");
    appHandlerPromise = Promise.resolve(serverless(app));
  }

  return appHandlerPromise;
}

export const handler = async (event: any, context: any) => {
  const appHandler = await getHandler();
  const result = await appHandler(event, context);

  await syncToSupabase();

  return result;
};
