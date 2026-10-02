"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error", error);
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ margin: 0, background: "#faf7ed", color: "#1e2438", fontFamily: '"Times New Roman", Times, serif' }}>
        <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <section style={{ width: "100%", maxWidth: 640, border: "1px solid rgba(30,36,56,0.13)", borderRadius: 14, background: "white", padding: 36, textAlign: "center", boxShadow: "0 2px 12px rgba(30,36,56,0.08)" }}>
            <p style={{ margin: 0, color: "#a8342b", fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Hệ thống tạm thời gián đoạn</p>
            <h1 style={{ margin: "12px 0 0", fontSize: 32, lineHeight: 1.25 }}>Không thể mở trang lúc này</h1>
            <p style={{ margin: "16px 0 0", color: "rgba(30,36,56,0.65)", lineHeight: 1.7 }}>Vui lòng thử lại. Nếu lỗi vẫn tiếp diễn, bạn có thể quay về trang chủ.</p>
            {error.digest ? <p style={{ margin: "12px 0 0", color: "rgba(30,36,56,0.42)", fontSize: 12 }}>Mã lỗi: {error.digest}</p> : null}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 28 }}>
              <button type="button" onClick={reset} style={{ cursor: "pointer", border: 0, borderRadius: 40, background: "#a8342b", padding: "12px 22px", color: "white", font: "inherit", fontWeight: 700 }}>Thử lại</button>
              <a href="/" style={{ border: "1px solid rgba(30,36,56,0.22)", borderRadius: 40, padding: "11px 22px", color: "#1b2444", fontWeight: 700, textDecoration: "none" }}>Về trang chủ</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
