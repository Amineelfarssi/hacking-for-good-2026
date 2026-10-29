/** The one Python server (ADK api_server plus the protocol, PDF, upload and feedback endpoints). */
export const ADK_URL = (process.env.ADK_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const APP_NAME = process.env.ADK_APP_NAME ?? "app";
export const USER_ID = process.env.ADK_USER_ID ?? "demo";

/** fetch() against the backend that returns null instead of throwing when it is unreachable. */
export async function backendFetch(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(`${ADK_URL}${path}`, init);
  } catch (err) {
    if (init?.signal?.aborted) throw err;
    console.warn("backend unreachable", { path, adk: ADK_URL });
    return null;
  }
}
