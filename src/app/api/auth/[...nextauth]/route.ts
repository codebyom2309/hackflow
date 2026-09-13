import { handlers } from "@/lib/auth/config";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  return handlers.POST(req);
}
