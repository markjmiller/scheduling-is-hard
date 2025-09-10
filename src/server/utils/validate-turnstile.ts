export async function validateTurnstile(
  token: string,
  remoteip: string | undefined,
): Promise<boolean> {
  const SECRET_KEY = import.meta.env.VITE_CF_TURNSTILE_SECRET_KEY;
  if (token.length === 0) {
    console.error("Turnstile token is empty");
    return false;
  }
  try {
    /*
      Example response:
      {
        "success": true,
        "challenge_ts": "2022-02-28T15:14:30.096Z",
        "hostname": "example.com",
        "error-codes": [],
        "action": "login",
        "cdata": "sessionid-123456789",
        "metadata": {
          "ephemeral_id": "x:9f78e0ed210960d7693b167e"
        }
      }
    */

    // console.log("Turnstile token:", token);
    // console.log("Turnstile remoteip:", remoteip);
    // console.log("Turnstile secret key:", SECRET_KEY);

    const requestBody: { secret: string; response: string; remoteip?: string } =
      {
        secret: SECRET_KEY,
        response: token,
      };

    if (remoteip) {
      requestBody.remoteip = remoteip;
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    const json_response = await response.json();

    // console.log("Turnstile response:", json_response);

    const result = json_response as { success: boolean };
    return result.success;
  } catch (error) {
    console.error("Turnstile validation error:", error);
    return false;
  }
}
