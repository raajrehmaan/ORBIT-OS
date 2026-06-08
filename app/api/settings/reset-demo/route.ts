import { NextResponse } from "next/server";
import { resetDemoTestData } from "@/lib/actions/settings";

export async function POST(request: Request) {
  try {
    const result = await resetDemoTestData(await request.formData());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Demo/test data could not be reset." },
      { status: 500 }
    );
  }
}
