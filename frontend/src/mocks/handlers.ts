import { http, HttpResponse } from "msw";
import type { AdminUserEntry } from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

function daysAgo(days: number): string {
  const d = new Date();
  d.setTime(d.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

const mockAdminUsers: AdminUserEntry[] = [
  { user_id: "KHEL-2026-001", role: "student", class_num: 8,  centre_id: "centre-001", is_active: true,  is_offboarded: false, last_accessed_at: daysAgo(0.1), inactive_days: 0    },
  { user_id: "KHEL-2026-002", role: "student", class_num: 7,  centre_id: "centre-001", is_active: true,  is_offboarded: false, last_accessed_at: daysAgo(1),   inactive_days: 1    },
  { user_id: "KHEL-2026-003", role: "student", class_num: 6,  centre_id: "centre-001", is_active: true,  is_offboarded: false, last_accessed_at: daysAgo(3),   inactive_days: 3    },
  { user_id: "KHEL-2026-004", role: "student", class_num: 10, centre_id: "centre-001", is_active: false, is_offboarded: false, last_accessed_at: daysAgo(32),  inactive_days: 32   },
  { user_id: "KHEL-2026-005", role: "student", class_num: 9,  centre_id: "centre-001", is_active: true,  is_offboarded: false, last_accessed_at: daysAgo(15),  inactive_days: 15   },
  { user_id: "KHEL-2026-006", role: "student", class_num: 8,  centre_id: "centre-002", is_active: true,  is_offboarded: false, last_accessed_at: daysAgo(2),   inactive_days: 2    },
  { user_id: "KHEL-2026-007", role: "student", class_num: 7,  centre_id: "centre-002", is_active: true,  is_offboarded: false, last_accessed_at: daysAgo(7),   inactive_days: 7    },
  { user_id: "KHEL-2026-008", role: "student", class_num: 6,  centre_id: "centre-002", is_active: true,  is_offboarded: false, last_accessed_at: null,          inactive_days: null },
  { user_id: "KHEL-2026-009", role: "student", class_num: 5,  centre_id: "centre-003", is_active: true,  is_offboarded: true,  last_accessed_at: daysAgo(45),  inactive_days: 45   },
  { user_id: "KHEL-2026-T01", role: "teacher", class_num: null, centre_id: "centre-001", is_active: true, is_offboarded: false, last_accessed_at: daysAgo(0.5), inactive_days: 0   },
];

export const handlers = [
  // ── Auth (mocked — returns dev tokens that the real backend accepts) ──
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as Record<string, string>;
    const offboarded = mockAdminUsers.find(u => u.user_id === body.student_id && u.is_offboarded);
    if (offboarded) {
      return HttpResponse.json({ detail: "Account offboarded. Contact your coordinator." }, { status: 403 });
    }
    if (body.student_id === "KHEL-2026-001" && body.pin === "1234") {
      return HttpResponse.json({ firebase_token: "dev-student-token", role: "student", class_num: 8, centre_id: "centre-001" });
    }
    if (body.student_id === "KHEL-2026-T01" && body.pin === "9999") {
      return HttpResponse.json({ firebase_token: "dev-teacher-token", role: "teacher", class_num: null, centre_id: "centre-001" });
    }
    if (body.student_id === "KHEL-2026-ADM1" && body.pin === "0000") {
      return HttpResponse.json({ firebase_token: "dev-admin-token", role: "admin", class_num: null, centre_id: "centre-001" });
    }
    return HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 });
  }),

  http.post(`${BASE}/auth/reset-pin`, () => HttpResponse.json({ success: true })),

  // ── Study, Test, Quiz — NOT mocked, go to real backend ──
  // (removed — requests pass through to http://localhost:8000)

  // ── Teacher scores (mocked until real data accumulates) ──
  http.get(`${BASE}/teacher/scores`, () =>
    HttpResponse.json({
      students: Array.from({ length: 8 }, (_, i) => ({
        student_id: `KHEL-2026-${String(i + 1).padStart(3, "0")}`,
        display_name: `Student #${String(i + 1).padStart(3, "0")}`,
        scores: [
          { score: 6 + (i % 4), total: 10, taken_at: new Date().toISOString() },
          { score: 5 + (i % 3), total: 10, taken_at: new Date().toISOString() },
        ],
        average_score: parseFloat((6.5 + (i % 4) * 0.5).toFixed(1)),
        weak_topics: i % 2 === 0 ? ["Photosynthesis", "Respiration"] : ["Algebra", "Geometry"],
      })),
    }),
  ),

  http.get(`${BASE}/teacher/weak-topics`, () =>
    HttpResponse.json({
      topic_breakdown: [
        { topic: "Photosynthesis", avg_score: 4.2, attempt_count: 12 },
        { topic: "Cell Division", avg_score: 5.1, attempt_count: 10 },
        { topic: "Respiration", avg_score: 5.8, attempt_count: 9 },
        { topic: "Algebra", avg_score: 6.3, attempt_count: 15 },
      ],
    }),
  ),

  // ── Quiz publish & assigned — NOT mocked, go to real backend ──

  // ── Admin (mocked — no real admin backend yet) ──
  http.post(`${BASE}/admin/offboard`, async ({ request }) => {
    const body = await request.json() as { user_id: string };
    const u = mockAdminUsers.find(u => u.user_id === body.user_id);
    if (!u) return HttpResponse.json({ detail: "User not found" }, { status: 404 });
    u.is_offboarded = true;
    u.is_active = false;
    return HttpResponse.json({ success: true });
  }),

  http.get(`${BASE}/admin/users`, ({ request }) => {
    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const centreId = url.searchParams.get("centre_id");
    const classNum = url.searchParams.get("class_num");

    let filtered = [...mockAdminUsers];
    if (role) filtered = filtered.filter((u) => u.role === role);
    if (centreId) filtered = filtered.filter((u) => u.centre_id === centreId);
    if (classNum) filtered = filtered.filter((u) => u.class_num === Number(classNum));

    return HttpResponse.json({ users: filtered });
  }),

  http.get(`${BASE}/admin/next-user-id`, ({ request }) => {
    const url = new URL(request.url);
    const role = url.searchParams.get("role") ?? "student";

    if (role === "teacher") {
      const nums = mockAdminUsers
        .filter((u) => u.role === "teacher")
        .map((u) => parseInt(u.user_id.match(/T(\d+)$/)?.[1] ?? "0", 10));
      const next = String(Math.max(0, ...nums) + 1).padStart(2, "0");
      return HttpResponse.json({ next_id: `KHEL-2026-T${next}` });
    } else {
      const nums = mockAdminUsers
        .filter((u) => u.role === "student")
        .map((u) => parseInt(u.user_id.match(/(\d+)$/)?.[1] ?? "0", 10));
      const next = String(Math.max(0, ...nums) + 1).padStart(3, "0");
      return HttpResponse.json({ next_id: `KHEL-2026-${next}` });
    }
  }),

  http.post(`${BASE}/admin/onboard`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const tempPin = String(Math.floor(1000 + Math.random() * 9000));
    const newUser: AdminUserEntry = {
      user_id: String(body.user_id ?? ""),
      role: (body.role as AdminUserEntry["role"]) ?? "student",
      class_num: body.class_num ? Number(body.class_num) : null,
      centre_id: String(body.centre_id ?? "centre-001"),
      is_active: true,
      is_offboarded: false,
      last_accessed_at: null,
      inactive_days: null,
    };
    mockAdminUsers.push(newUser);
    return HttpResponse.json({ temp_pin: tempPin });
  }),

  http.post(`${BASE}/admin/reset-pin`, () => HttpResponse.json({ success: true })),

  // admin/upload-pdf, admin/textbooks, admin/textbooks/:id — NOT mocked, go to real backend
];
