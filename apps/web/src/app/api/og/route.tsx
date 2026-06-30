import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "UjCha — Matcha & More";
  const description =
    searchParams.get("description") ??
    "Matcha ceremonial grade, cà phê và đồ uống thủ công tại Đà Nẵng";

  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Forest green top bar */}
        <div style={{ backgroundColor: "#1a3c34", height: 8, width: "100%" }} />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "60px 80px",
          }}
        >
          {/* Brand label */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#717171",
              marginBottom: 24,
            }}
          >
            UJCHA.VN
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: title.length > 60 ? 36 : 48,
              fontWeight: 700,
              color: "#1a1a1a",
              lineHeight: 1.2,
              marginBottom: 20,
              maxWidth: 900,
            }}
          >
            {title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 22,
              color: "#717171",
              lineHeight: 1.5,
              maxWidth: 800,
              marginBottom: 40,
            }}
          >
            {description.slice(0, 120)}
            {description.length > 120 ? "…" : ""}
          </div>

          {/* Tag */}
          <div
            style={{
              backgroundColor: "#1a3c34",
              color: "#ffffff",
              borderRadius: 9999,
              padding: "10px 24px",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Matcha · Cà Phê · Trà Thủ Công
          </div>
        </div>

        {/* Forest green bottom bar */}
        <div style={{ backgroundColor: "#1a3c34", height: 6, width: "100%" }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
