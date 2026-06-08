import { NextResponse } from "next/server";
import { deleteAppointment } from "@/lib/actions/appointments";

export async function POST(request: Request) {
  const body = await request.json();
  const formData = new FormData();
  formData.set("id", String(body.id ?? ""));
  formData.set("admin_pin", String(body.admin_pin ?? ""));
  formData.set("cancellation_reason", String(body.cancellation_reason ?? ""));

  try {
    const result = await deleteAppointment(formData);
    if (!result?.success) {
      return NextResponse.json({ error: result?.message ?? "Appointment could not be cancelled" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Appointment could not be cancelled" },
      { status: 400 }
    );
  }
}
