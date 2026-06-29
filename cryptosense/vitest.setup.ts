import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock server-only for tests
vi.mock("server-only", () => ({}), { virtual: true });
