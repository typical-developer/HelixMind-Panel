/**
 * Where the panel sends auth requests.
 *
 * Same-origin by default, and deliberately so. Calling the backend's host
 * directly only ever worked from `http://localhost:3000` — the one origin on
 * its CORS allowlist — so the deployed panel could not sign in at all: the
 * preflight came back 500 with no `Access-Control-Allow-Origin`, the browser
 * blocked the request, and `fetch` rejected with the bare `TypeError` this
 * file reports as "Could not reach the server".
 *
 * `/api/backend` is rewritten to the real host by `next.config.mjs`, server
 * side, where CORS does not apply. Point `NEXT_PUBLIC_API_URL` at an absolute
 * URL to bypass the proxy and talk to a backend directly — useful against a
 * local API, and fine anywhere the origin is on the allowlist.
 *
 * The emptiness check matters: an env var that is *set but blank* is not
 * nullish, so `??` would hand `fetch` an empty base and every call would go to
 * the wrong place. See `.env.example`.
 */
const configuredBase = process.env.NEXT_PUBLIC_API_URL?.trim();

const BASE_URL =
  configuredBase && configuredBase.length > 0
    ? configuredBase.replace(/\/+$/, "")
    : "/api/backend";

/** Milliseconds before a request is abandoned. */
const REQUEST_TIMEOUT = 20_000;

const request = async function <T>(
  endpoint: string,
  options: {
    method?: "POST" | "GET" | "DELETE" | "PUT";
    body?: any;
    headers?: Record<string, any>;
  } = {}
): Promise<T> {
  try {
    const bearer_token = localStorage.getItem("Helix_user_token") ?? "";

    const headers = {
      ...(bearer_token.trim().length > 0 && {
        Authorization: `Bearer ${bearer_token}`,
      }),
      ...options.headers,
    };


    // A hosted backend that has gone to sleep can hold a socket open for
    // minutes. Without this the sign-in button simply stayed in its loading
    // state forever with nothing to tell the user why.
    const response = await fetch(BASE_URL + endpoint, {
      method: options.method ?? "GET",
      ...(options.body && { body: options.body }),
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    // The body was parsed as JSON unconditionally, so an HTML error page from
    // a proxy — or an empty 204 — threw a `SyntaxError` whose message
    // ("Unexpected token '<'") was then shown to the user as if the server had
    // said it.
    let output: any = null;
    const text = await response.text();
    if (text) {
      try {
        output = JSON.parse(text);
      } catch {
        throw new Error(
          response.ok
            ? "The server sent a response the panel could not read."
            : `Request failed (${response.status} ${response.statusText}).`
        );
      }
    }

    if (response.ok != true) {
      throw new Error(
        output?.error ??
          output?.message ??
          `Request failed (${response.status} ${response.statusText}).`
      );
    }

    if (output?.status !== "success") {
      throw new Error(output?.error ?? "Internal Server error");
    }

    return (output.payload || output.data) as T;
  } catch (error) {
    // Surface the failure to the caller; do not log response bodies, which can
    // carry account details, to the browser console.
    //
    // Always an `Error`. This used to throw the *message string* on the error
    // path, so every `catch (e) { e instanceof Error ? e.message : e }` at a
    // call site fell through to the non-Error branch.
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(
        "The server took too long to respond. Check your connection and try again."
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the server. Check your connection and try again."
      );
    }
    throw error instanceof Error
      ? error
      : new Error("Something went wrong, try again");
  }
};

export { request };
