import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { analyticsSchema } from "@/lib/validation";

const USER_AGENT_MAX = 512;

export async function POST(request: NextRequest) {
  const payload = await readPayload(request);
  const parsed = analyticsSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid analytics payload." }, { status: 400 });
  }

  await prisma.pageView.create({
    data: {
      path: parsed.data.path,
      referrer: parsed.data.referrer || null,
      userAgent: truncate(request.headers.get("user-agent"), USER_AGENT_MAX),
    },
  });

  return NextResponse.json({ ok: true });
}

async function readPayload(request: NextRequest) {
  try {
    return await request.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid JSON." };
  }
}

function truncate(value: string | null, maxLength: number) {
  if (!value) {
    return null;
  }

  return value.slice(0, maxLength);
}
