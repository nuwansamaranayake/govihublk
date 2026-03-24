/**
 * GoviHub API Client Tests
 * Tests for auth handling, token refresh, error propagation, and request building.
 *
 * To run: npx jest __tests__/api-client.test.ts
 */

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Import the module under test
// ---------------------------------------------------------------------------

import {
  setAccessToken,
  getAccessToken,
  ApiException,
  api,
} from "../src/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : `HTTP ${status}`,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    headers: new Headers(headers),
    url: "",
    redirected: false,
    type: "default",
    body: null,
    bodyUsed: false,
    clone: jest.fn(),
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
  } as unknown as Response;
}

function noContentResponse(): Response {
  return {
    ok: true,
    status: 204,
    statusText: "No Content",
    json: jest.fn(),
    headers: new Headers(),
    url: "",
    redirected: false,
    type: "default",
    body: null,
    bodyUsed: false,
    clone: jest.fn(),
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    text: jest.fn(),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset();
  setAccessToken(null);
});

// ---------------------------------------------------------------------------
// Token management tests
// ---------------------------------------------------------------------------

describe("Access Token Management", () => {
  test("getAccessToken returns null initially", () => {
    expect(getAccessToken()).toBeNull();
  });

  test("setAccessToken stores a token", () => {
    setAccessToken("test-jwt-token");
    expect(getAccessToken()).toBe("test-jwt-token");
  });

  test("setAccessToken can clear the token", () => {
    setAccessToken("some-token");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  test("token is included in Authorization header when set", async () => {
    setAccessToken("my-access-token");
    mockFetch.mockResolvedValueOnce(mockResponse({ data: "ok" }));

    await api.get("/api/v1/users/me");

    const [, requestInit] = mockFetch.mock.calls[0];
    expect(requestInit.headers["Authorization"]).toBe("Bearer my-access-token");
  });

  test("no Authorization header when token is null", async () => {
    setAccessToken(null);
    mockFetch.mockResolvedValueOnce(mockResponse({ data: "ok" }));

    await api.get("/api/v1/health");

    const [, requestInit] = mockFetch.mock.calls[0];
    expect(requestInit.headers["Authorization"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Successful request tests
// ---------------------------------------------------------------------------

describe("Successful Requests", () => {
  test("GET request returns parsed JSON", async () => {
    const responseData = { id: "123", name: "Farmer" };
    mockFetch.mockResolvedValueOnce(mockResponse(responseData));

    const result = await api.get<typeof responseData>("/api/v1/users/me");

    expect(result).toEqual(responseData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/v1/users/me");
    expect(init.method).toBe("GET");
  });

  test("POST request sends JSON body", async () => {
    const responseData = { created: true };
    mockFetch.mockResolvedValueOnce(mockResponse(responseData, 201));

    const body = { name: "Tomato", quantity: 100 };
    await api.post("/api/v1/listings/harvest", body);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual(body);
  });

  test("PATCH request sends JSON body", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ updated: true }));

    await api.patch("/api/v1/users/me", { name: "New Name" });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("PATCH");
  });

  test("DELETE request is sent correctly", async () => {
    mockFetch.mockResolvedValueOnce(noContentResponse());

    await api.delete("/api/v1/listings/harvest/uuid-123");

    const [url, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("DELETE");
    expect(url).toContain("uuid-123");
  });

  test("204 No Content returns undefined", async () => {
    mockFetch.mockResolvedValueOnce(noContentResponse());

    const result = await api.delete("/api/v1/notifications/read-all");
    expect(result).toBeUndefined();
  });

  test("credentials: include is always set", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    await api.get("/api/v1/health");

    const [, init] = mockFetch.mock.calls[0];
    expect(init.credentials).toBe("include");
  });
});

// ---------------------------------------------------------------------------
// Error handling tests
// ---------------------------------------------------------------------------

describe("Error Handling", () => {
  test("throws ApiException on 400 error", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ detail: "Validation error", code: "INVALID_INPUT" }, 400)
    );

    await expect(api.post("/api/v1/listings/harvest", {})).rejects.toThrow(ApiException);
  });

  test("ApiException has correct status code", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ detail: "Not found" }, 404)
    );

    try {
      await api.get("/api/v1/listings/harvest/nonexistent");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiException);
      expect((err as ApiException).status).toBe(404);
    }
  });

  test("ApiException message comes from detail field", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ detail: "Resource not found" }, 404)
    );

    try {
      await api.get("/api/v1/notfound");
    } catch (err) {
      expect((err as ApiException).message).toBe("Resource not found");
    }
  });

  test("ApiException message falls back to message field", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ message: "Custom error message" }, 422)
    );

    try {
      await api.post("/api/v1/test", {});
    } catch (err) {
      expect((err as ApiException).message).toBe("Custom error message");
    }
  });

  test("throws ApiException with statusText when body is non-JSON", async () => {
    const badResponse = {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: jest.fn().mockRejectedValue(new Error("Not JSON")),
      headers: new Headers(),
      url: "",
      redirected: false,
      type: "default",
      body: null,
      bodyUsed: false,
      clone: jest.fn(),
      arrayBuffer: jest.fn(),
      blob: jest.fn(),
      formData: jest.fn(),
      text: jest.fn().mockResolvedValue("Service Unavailable"),
    } as unknown as Response;

    mockFetch.mockResolvedValueOnce(badResponse);

    try {
      await api.get("/api/v1/health");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiException);
      expect((err as ApiException).status).toBe(503);
    }
  });
});

// ---------------------------------------------------------------------------
// Token refresh (401 handling) tests
// ---------------------------------------------------------------------------

describe("Token Refresh on 401", () => {
  test("auto-refreshes on 401 and retries request", async () => {
    setAccessToken("expired-token");

    // First call: 401
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: "Expired" }, 401));

    // Refresh call: success with new token
    mockFetch.mockResolvedValueOnce(
      mockResponse({ access_token: "new-token-xyz" }, 200)
    );

    // Retry call: success
    mockFetch.mockResolvedValueOnce(mockResponse({ id: "user-123" }, 200));

    const result = await api.get<{ id: string }>("/api/v1/users/me");

    expect(result.id).toBe("user-123");
    expect(getAccessToken()).toBe("new-token-xyz");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test("throws 401 ApiException when refresh fails", async () => {
    setAccessToken("expired-token");

    // First call: 401
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: "Expired" }, 401));

    // Refresh call: also fails
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: "Refresh expired" }, 401));

    await expect(api.get("/api/v1/users/me")).rejects.toThrow(ApiException);

    const err = await api.get("/api/v1/users/me").catch((e) => e);
    expect(err.status).toBe(401);
  });

  test("clears access token when refresh returns non-OK", async () => {
    setAccessToken("old-token");

    mockFetch.mockResolvedValueOnce(mockResponse({}, 401));
    mockFetch.mockResolvedValueOnce(mockResponse({}, 400)); // refresh fails

    await api.get("/api/v1/users/me").catch(() => {});

    // After a failed refresh, token should be cleared
    expect(getAccessToken()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FormData upload tests
// ---------------------------------------------------------------------------

describe("File Upload", () => {
  test("upload does not set Content-Type for FormData", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ url: "https://..." }));

    const formData = new FormData();
    formData.append("file", new Blob(["fake image"], { type: "image/jpeg" }), "crop.jpg");

    await api.upload("/api/v1/diagnosis/predict", formData);

    const [, init] = mockFetch.mock.calls[0];
    // Content-Type should NOT be set for FormData (browser sets it with boundary)
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
  });
});
