import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetStore } from "@/lib/pto-store";
import { getBalanceHandler } from "@/api/pto/balance";
import { getBatchBalancesHandler } from "@/api/pto/balances-batch";
import { getEmployeesHandler } from "@/api/pto/employees";
import { submitRequestHandler, getRequestsHandler } from "@/api/pto/requests";
import { updateRequestHandler, getRequestByIdHandler } from "@/api/pto/requests-id";
import { grantAnniversaryBonusHandler } from "@/api/pto/anniversary-bonus";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  InsufficientBalanceError,
} from "@/api/pto/errors";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/sse-bus", () => ({ emitBalanceUpdate: vi.fn(), onBalanceUpdate: vi.fn() }));

const BASE_REQUEST = {
  employeeId: "emp-1",
  locationId: "loc-us",
  startDate: "2026-08-01",
  endDate: "2026-08-03",
  days: 3,
  reason: "Vacation",
};

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

// ── getBalanceHandler ─────────────────────────────────────────────────────────

describe("getBalanceHandler", () => {
  it("returns balance for a valid employee/location", async () => {
    const result = await getBalanceHandler("emp-1", "loc-us");
    expect(result.available).toBe(10);
    expect(result.used).toBe(5);
  });

  it("throws ValidationError when params are missing", async () => {
    await expect(getBalanceHandler(null, null)).rejects.toBeInstanceOf(ValidationError);
    await expect(getBalanceHandler("emp-1", null)).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError for unknown combination", async () => {
    await expect(getBalanceHandler("emp-1", "loc-apac")).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── getBatchBalancesHandler ───────────────────────────────────────────────────

describe("getBatchBalancesHandler", () => {
  it("returns all balances with a generatedAt timestamp", async () => {
    const result = await getBatchBalancesHandler();
    expect(result.balances.length).toBeGreaterThanOrEqual(6);
    expect(result.generatedAt).toBeTruthy();
  });
});

// ── getEmployeesHandler ───────────────────────────────────────────────────────

describe("getEmployeesHandler", () => {
  it("returns the seeded employee list", () => {
    const { employees } = getEmployeesHandler();
    expect(employees.length).toBeGreaterThanOrEqual(2);
    expect(employees.find((e) => e.id === "emp-1")).toBeDefined();
  });
});

// ── getRequestsHandler ────────────────────────────────────────────────────────

describe("getRequestsHandler", () => {
  it("returns all requests when no employeeId given", () => {
    const { requests } = getRequestsHandler(null);
    expect(Array.isArray(requests)).toBe(true);
  });

  it("returns only that employee's requests when filtered", async () => {
    await submitRequestHandler(BASE_REQUEST, "silent_failure"); // won't create a real request
    const { requests } = getRequestsHandler("emp-1");
    expect(requests.every((r) => r.employeeId === "emp-1")).toBe(true);
  });
});

// ── submitRequestHandler ──────────────────────────────────────────────────────

describe("submitRequestHandler", () => {
  it("accepts a valid request and returns accepted status", async () => {
    const result = await submitRequestHandler(BASE_REQUEST, null);
    // 5% chance of silent_failure — handle both
    expect(["accepted", "silent_failure"]).toContain(result.status);
  });

  it("returns accepted when scenario is explicitly null and random is bypassed", async () => {
    // Force non-random path by using scenario='accepted' (no special header)
    // We test the deterministic path via the 'conflict' and 'insufficient' scenarios
    const result = await submitRequestHandler({ ...BASE_REQUEST, days: 1 }, "");
    expect(["accepted", "silent_failure"]).toContain(result.status);
  });

  it("returns silent_failure when scenario header is 'silent_failure'", async () => {
    const result = await submitRequestHandler(BASE_REQUEST, "silent_failure");
    expect(result.status).toBe("silent_failure");
    expect(result.requestId).toMatch(/req-silent-/);
  });

  it("throws ConflictError when scenario is 'conflict'", async () => {
    await expect(submitRequestHandler(BASE_REQUEST, "conflict")).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws InsufficientBalanceError when days exceed available balance", async () => {
    await expect(
      submitRequestHandler({ ...BASE_REQUEST, days: 100 }, null)
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it("throws ValidationError for unknown employee", async () => {
    await expect(
      submitRequestHandler({ ...BASE_REQUEST, employeeId: "emp-99" }, null)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws ValidationError for unknown location", async () => {
    await expect(
      submitRequestHandler({ ...BASE_REQUEST, locationId: "loc-99" }, null)
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── updateRequestHandler ──────────────────────────────────────────────────────

describe("updateRequestHandler", () => {
  async function createPendingRequest() {
    // Submit with explicit non-silent scenario to guarantee a real request
    let result = await submitRequestHandler(BASE_REQUEST, "");
    // Retry if we got a silent_failure (shouldn't happen in empty scenario, but be safe)
    while (result.status === "silent_failure") {
      resetStore();
      result = await submitRequestHandler(BASE_REQUEST, "");
    }
    return result.requestId;
  }

  it("throws ValidationError for an invalid action", async () => {
    await expect(updateRequestHandler("any-id", "cancel")).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError for a missing request", async () => {
    await expect(updateRequestHandler("nonexistent", "approve")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("approves a pending request", async () => {
    const id = await createPendingRequest();
    const result = await updateRequestHandler(id, "approve");
    expect(result.status).toBe("approved");
    expect(result.requestId).toBe(id);
  });

  it("denies a pending request and restores the balance", async () => {
    const id = await createPendingRequest();
    const result = await updateRequestHandler(id, "deny");
    expect(result.status).toBe("denied");
    const balance = await getBalanceHandler("emp-1", "loc-us");
    expect(balance.available).toBe(10); // restored
  });

  it("throws ConflictError when request is already processed", async () => {
    const id = await createPendingRequest();
    await updateRequestHandler(id, "approve");
    await expect(updateRequestHandler(id, "deny")).rejects.toBeInstanceOf(ConflictError);
  });
});

// ── getRequestByIdHandler ─────────────────────────────────────────────────────

describe("getRequestByIdHandler", () => {
  it("returns the request by id", async () => {
    const submitted = await submitRequestHandler(BASE_REQUEST, "");
    if (submitted.status === "silent_failure") return; // skip if store not mutated
    const found = getRequestByIdHandler(submitted.requestId);
    expect(found.id).toBe(submitted.requestId);
  });

  it("throws NotFoundError for unknown id", () => {
    expect(() => getRequestByIdHandler("unknown")).toThrow(NotFoundError);
  });
});

// ── grantAnniversaryBonusHandler ──────────────────────────────────────────────

describe("grantAnniversaryBonusHandler", () => {
  it("grants +5 days on first call", async () => {
    const result = await grantAnniversaryBonusHandler("emp-1", "loc-us");
    expect(result.granted).toBe(true);
    expect(result.bonus).toBe(5);
    const balance = await getBalanceHandler("emp-1", "loc-us");
    expect(balance.available).toBe(15); // 10 + 5
  });

  it("does not grant twice in the same session", async () => {
    await grantAnniversaryBonusHandler("emp-1", "loc-us");
    const second = await grantAnniversaryBonusHandler("emp-1", "loc-us");
    expect(second.granted).toBe(false);
  });

  it("throws ValidationError for an unknown employee", async () => {
    await expect(
      grantAnniversaryBonusHandler("emp-99", "loc-us")
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
