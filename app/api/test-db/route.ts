import sql from "@/lib/db";

export async function GET() {
  try {
    const result = await sql`SELECT NOW() as current_time`;

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: String(error),
    });
  }
}