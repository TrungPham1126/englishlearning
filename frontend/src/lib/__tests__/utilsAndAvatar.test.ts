import { describe, it, expect, vi, afterEach } from "vitest";
import { cn } from "@/lib/utils";
import { resolveAvatarUrl } from "@/lib/avatar";

describe("lib/utils - cn()", () => {
  it("hợp nhất nhiều class và xử lý điều kiện falsy an toàn", () => {
    const hasBorder = false;
    const isActive = true;
    const result = cn("px-2", hasBorder && "border", isActive && "bg-blue-600", undefined, null);
    expect(result).toBe("px-2 bg-blue-600");
  });

  it("loại bỏ xung đột Tailwind theo quy tắc ưu tiên class sau", () => {
    expect(cn("p-2 text-sm text-slate-500", "p-4 text-slate-900")).toBe(
      "text-sm p-4 text-slate-900",
    );
  });
});

describe("lib/avatar - resolveAvatarUrl()", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("trả về chuỗi rỗng khi url null, undefined, rỗng hoặc không phải string", () => {
    expect(resolveAvatarUrl(null)).toBe("");
    expect(resolveAvatarUrl(undefined)).toBe("");
    expect(resolveAvatarUrl("   ")).toBe("");
    expect(resolveAvatarUrl(123 as unknown as string)).toBe("");
  });

  it("giữ nguyên URL tuyệt đối http, https, data và blob sau khi trim", () => {
    expect(resolveAvatarUrl("  https://cdn.example.com/a.png  ")).toBe(
      "https://cdn.example.com/a.png",
    );
    expect(resolveAvatarUrl("http://localhost:8080/uploads/avatar.jpg")).toBe(
      "http://localhost:8080/uploads/avatar.jpg",
    );
    expect(resolveAvatarUrl("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(resolveAvatarUrl("blob:http://localhost:5173/uuid-1")).toBe(
      "blob:http://localhost:5173/uuid-1",
    );
  });

  it("nối đường dẫn tương đối với VITE_API_BASE_URL (có hoặc không có dấu / ở cuối)", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.elp.edu.vn/");
    expect(resolveAvatarUrl("uploads/avatars/u1.png")).toBe(
      "https://api.elp.edu.vn/uploads/avatars/u1.png",
    );
    expect(resolveAvatarUrl("/uploads/avatars/u1.png")).toBe(
      "https://api.elp.edu.vn/uploads/avatars/u1.png",
    );

    vi.stubEnv("VITE_API_BASE_URL", "");
    expect(resolveAvatarUrl("uploads/u2.png")).toBe("/uploads/u2.png");
  });
});
