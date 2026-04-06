import { getDashboardOverview } from "@/lib/queries/dashboard";

export async function GET() {
  try {
    const data = await getDashboardOverview();
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
