import crypto from "crypto";

// ============================================
// QR Code Service
// ============================================

/**
 * QR payload format: hackflow:<eventId>:<teamId>:<hmac>
 */
export function generateQRPayload(
  eventId: string,
  teamId: string,
  secret: string
): string {
  const data = `${eventId}:${teamId}`;
  const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return `hackflow:${eventId}:${teamId}:${hmac.substring(0, 16)}`;
}

/**
 * Validate a scanned QR payload.
 * Returns parsed data or null if invalid.
 */
export function validateQRPayload(
  payload: string,
  secret: string
): { eventId: string; teamId: string } | null {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "hackflow") return null;

  const [, eventId, teamId, receivedHmac] = parts;
  const data = `${eventId}:${teamId}`;
  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex")
    .substring(0, 16);

  // Timing-safe comparison
  if (receivedHmac.length !== expectedHmac.length) return null;

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(receivedHmac, "hex"),
      Buffer.from(expectedHmac, "hex")
    );
    if (!valid) return null;
  } catch {
    return null;
  }

  return { eventId, teamId };
}

/**
 * Generate a base64 Data URL for a QR code.
 */
export async function generateQRCodeDataURL(payload: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(payload, {
    width: 320,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

/**
 * Generate a PNG Buffer for downloadable QR code.
 */
export async function generateQRCodeBuffer(payload: string): Promise<Buffer> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toBuffer(payload, {
    type: "png",
    width: 512,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

