import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
    }

    const body = await req.json();
    const role = body.role;

    // Only allow selecting RIDER or DRIVER during onboarding (never ADMIN)
    if (role !== "RIDER" && role !== "DRIVER") {
      return NextResponse.json(
        { error: { code: "INVALID_ROLE", message: "Only RIDER or DRIVER role can be selected during onboarding." } },
        { status: 400 }
      );
    }

    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: role.toUpperCase(),
      },
    });

    return NextResponse.json({ data: { success: true, role } });
  } catch (error: unknown) {
    console.error("Failed to update role in publicMetadata:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: { code: "SERVER_ERROR", message } }, { status: 500 });
  }
}
