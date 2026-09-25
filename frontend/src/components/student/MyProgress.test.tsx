import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MyProgress } from "./MyProgress";
import { studentApi } from "../../api";
import type { StudentProgress } from "../../types";

const mockProgress: StudentProgress = {
  overall_pct: 72,
  total_tests: 5,
  study_streak_days: 3,
  by_subject: [
    {
      subject: "mathematics",
      tests_taken: 3,
      score: 18,
      total: 25,
      average_pct: 72,
      weak_topics: [{ topic: "Fractions", count: 2 }],
    },
  ],
  timeline: [
    {
      date: new Date().toISOString(),
      subject: "mathematics",
      chapter: "Squares",
      score: 8,
      total: 10,
      pct: 80,
      source: "practice",
    },
  ],
};

vi.mock("../../stores/AuthContext", () => ({
  useAuth: () => ({
    user: { studentId: "KHEL-2026-001", firebaseToken: "tok", role: "student", classNum: 8 },
  }),
}));

vi.mock("../../api", () => ({
  studentApi: {
    progress: vi.fn(),
  },
}));

vi.mock("../shared/SkeletonCard", () => ({
  SkeletonCard: () => <div data-testid="skeleton" />,
}));

const mockedProgress = vi.mocked(studentApi.progress);

describe("MyProgress", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton initially", () => {
    mockedProgress.mockReturnValue(new Promise(() => {}));
    render(<MyProgress onBack={onBack} />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("displays progress data when loaded", async () => {
    mockedProgress.mockResolvedValue(mockProgress);
    render(<MyProgress onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Overall")).toBeInTheDocument();
    });
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/3 day streak/)).toBeInTheDocument();
    expect(screen.getAllByText(/mathematics/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Fractions (2)")).toBeInTheDocument();
  });

  it("shows empty state when no tests taken", async () => {
    mockedProgress.mockResolvedValue({
      ...mockProgress,
      total_tests: 0,
      by_subject: [],
      timeline: [],
    });

    render(<MyProgress onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("No progress yet")).toBeInTheDocument();
    });
  });

  it("shows error state on failure", async () => {
    mockedProgress.mockRejectedValue(new Error("Network error"));

    render(<MyProgress onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });
});
