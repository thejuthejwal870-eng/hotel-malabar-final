import serverless from "serverless-http";
import { app } from "../../api";

export const handler = serverless(app);
