import { getCountySummary } from "@/lib/queries/dashboard";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = Number.isFinite(Number(limitParam)) ? Number(limitParam) : 25;

    const data = await getCountySummary(limit);
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
