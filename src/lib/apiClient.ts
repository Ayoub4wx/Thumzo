import { supabase } from "./supabase";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function buildHeaders(extraHeaders?: HeadersInit, hasJsonBody?: boolean) {
  const headers = new Headers(extraHeaders);
  let {
    data: { session },
  } = await supabase.auth.getSession();

  const expiresAtMs =
    typeof session?.expires_at === "number"
      ? session.expires_at * 1000
      : null;

  if (session && expiresAtMs && expiresAtMs <= Date.now() + 60_000) {
    const { data, error } = await supabase.auth.refreshSession();

    if (!error && data?.session) {
      session = data.session;
    }
  }

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  if (hasJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
};

function isRawBody(value: ApiRequestInit["body"]): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof ReadableStream
  );
}

export async function apiFetch<T>(input: string, init: ApiRequestInit = {}) {
  const response = await apiFetchResponse(input, init);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  return payload as T;
}

export async function apiFetchResponse(input: string, init: ApiRequestInit = {}) {
  const hasJsonBody = init.body != null && !isRawBody(init.body);
  const requestBody = hasJsonBody ? JSON.stringify(init.body) : (init.body as BodyInit | null | undefined);

  const sendRequest = async () =>
    fetch(input, {
      ...init,
      headers: await buildHeaders(init.headers, hasJsonBody),
      body: requestBody,
    });

  let response = await sendRequest();

  if (!response.ok) {
    const clonedResponse = response.clone();
    const contentType = clonedResponse.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await clonedResponse.json() : await clonedResponse.text();
    const topLevelError =
      typeof payload === "object" && payload && "error" in payload ? (payload as any).error : null;
    const detailsError =
      typeof payload === "object" && payload && "details" in payload && typeof (payload as any).details === "object"
        ? (payload as any).details?.error
        : null;
    const message =
      typeof topLevelError === "string"
        ? topLevelError
        : topLevelError && typeof topLevelError === "object" && typeof topLevelError.message === "string"
          ? topLevelError.message
          : detailsError && typeof detailsError === "object" && typeof detailsError.message === "string"
            ? detailsError.message
            : response.statusText || "Request failed.";
    const shouldRetryExpiredSession =
      response.status === 401 &&
      typeof message === "string" &&
      (message.toLowerCase().includes("invalid or expired session") || message.toLowerCase().includes("missing bearer token"));

    if (shouldRetryExpiredSession) {
      const { data, error } = await supabase.auth.refreshSession();

      if (!error && data?.session?.access_token) {
        response = await sendRequest();

        if (response.ok) {
          return response;
        }
      } else {
        await supabase.auth.signOut();
      }
    }

    if (response.status === 401 && typeof message === "string" && message.toLowerCase().includes("invalid or expired session")) {
      await supabase.auth.signOut();
    }

    throw new ApiError(message, response.status, payload);
  }

  return response;
}
