const BASE_URL = "https://helix-core-backend.onrender.com/api/v1";

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


    const response = await fetch(BASE_URL + endpoint, {
      method: options.method ?? "GET",
      ...(options.body && { body: options.body }),
      headers,
    });

    const output = await response.json();

    if (response.ok != true) {
      throw new Error(
        output.error ??
          (await response.text()) ??
          "Something went wrong, try again"
      );
    }

    if (output.status !== "success") {
      throw new Error(output.error ?? "Internal Server error");
    }

    return (output.payload || output.data) as T;
  } catch (error) {
    // Surface the failure to the caller; do not log response bodies, which can
    // carry account details, to the browser console.
    throw error instanceof Error
      ? error.message
      : "Something went wrong, try again";
  }
};

export { request };
