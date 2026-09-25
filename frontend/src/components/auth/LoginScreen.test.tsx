import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginScreen } from "./LoginScreen";

vi.mock("../../stores/AuthContext", () => ({
  useAuth: () => ({ setUser: vi.fn() }),
}));

vi.mock("../../api", () => ({
  authApi: {
    login: vi.fn(),
  },
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form with all fields", () => {
    render(<LoginScreen />);
    expect(screen.getByLabelText("Student ID")).toBeInTheDocument();
    expect(screen.getByLabelText("PIN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start studying/i })).toBeInTheDocument();
  });

  it("validates student ID format", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText("Student ID"), "invalid");
    await user.type(screen.getByLabelText("PIN"), "1234");
    await user.click(screen.getByRole("button", { name: /start studying/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Student ID format");
  });

  it("validates PIN must be 4-6 digits", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText("Student ID"), "KHEL-2026-001");
    await user.type(screen.getByLabelText("PIN"), "12");
    await user.click(screen.getByRole("button", { name: /start studying/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("PIN must be 4");
  });

  it("accepts valid student ID format", async () => {
    const { authApi } = await import("../../api");
    (authApi.login as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: "student",
      class_num: 8,
      centre_id: "C1",
      firebase_token: "tok",
    });

    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText("Student ID"), "KHEL-2026-001");
    await user.type(screen.getByLabelText("PIN"), "1234");
    await user.click(screen.getByRole("button", { name: /start studying/i }));

    expect(authApi.login).toHaveBeenCalledWith("KHEL-2026-001", "1234");
  });
});
