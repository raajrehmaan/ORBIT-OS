import { NextResponse } from "next/server";
import { updateSecuritySettings } from "@/lib/actions/settings";

export async function POST(request: Request) {
  try {
    const result = await updateSecuritySettings(await request.formData());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Security settings could not be saved." },
      { status: 500 }
    );
  }
}
