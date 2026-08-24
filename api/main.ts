/**
 * Where the auth API lives.
 *
 * This was a hard-coded production URL, which meant pointing the panel at a
 * local or staging backend required editing source. `NEXT_PUBLIC_` is required
 * for the value to reach the browser, and the previous URL stays as the
 * default so an unconfigured deployment behaves exactly as it did.
 *
 * See `.env.example`.
 */
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://helix-core-backend.onrender.com/api/v1";

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
