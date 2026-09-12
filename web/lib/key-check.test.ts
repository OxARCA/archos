import { describe, expect, it, vi } from "vitest";
import { checkWithProvider } from "./key-check";

const KEY = "sk-proj-test-secret-9876";

function stubFetch(result: Response | Error) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("checkWithProvider", () => {
  it("asks OpenAI's models endpoint, with the key only in the Authorization header", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));
    await expect(checkWithProvider("openai", KEY)).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/models");
    expect(init?.headers).toEqual({ authorization: `Bearer ${KEY}` });
    expect(init?.redirect).toBe("error");
  });

  it("asks Anthropic's models endpoint with x-api-key and a version header", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));
    await expect(checkWithProvider("anthropic", "sk-ant-test")).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/models");
    expect(init?.headers).toEqual({ "x-api-key": "sk-ant-test", "anthropic-version": "2023-06-01" });
  });

  it.each([
    [401, "didn't accept this key"],
    [403, "refused access"],
    [500, "status 500"],
  ])("explains a %i without repeating the key", async (status, text) => {
    stubFetch(new Response(null, { status }));
    const result = await checkWithProvider("openai", KEY);
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining(text) });
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("explains a network failure", async () => {
    stubFetch(new TypeError("fetch failed"));
    await expect(checkWithProvider("anthropic", "sk-ant-test")).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining("Couldn't reach Anthropic"),
    });
  });

  it("uses KEY_CHECK_BASE_URL in development but never in production", async () => {
    vi.stubEnv("KEY_CHECK_BASE_URL", "http://127.0.0.1:4010");

    vi.stubEnv("NODE_ENV", "development");
    let fetchMock = stubFetch(new Response("{}", { status: 200 }));
    await checkWithProvider("openai", KEY);
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:4010/v1/models");

    vi.stubEnv("NODE_ENV", "production");
    fetchMock = stubFetch(new Response("{}", { status: 200 }));
    await checkWithProvider("openai", KEY);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/models");
  });
});
