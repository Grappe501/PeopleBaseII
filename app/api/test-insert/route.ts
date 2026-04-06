import sql from "@/lib/db";

export async function GET() {
  try {
    await sql`
      insert into voters (voter_id, first_name, last_name, county)
      values ('TEST123', 'Steve', 'Grappe', 'Pulaski')
    `;

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({
      success: false,
      error: String(error),
    });
  }
}