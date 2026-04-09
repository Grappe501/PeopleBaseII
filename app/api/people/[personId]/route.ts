import { NextResponse } from "next/server";
import { getPersonById } from "@/lib/queries/people";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type { PersonRow } from "@/lib/types/people";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ personId: string }> }) {
  try {
    const { personId } = await ctx.params;
    const person = await getPersonById(personId);
    if (!person) {
      const body: ApiResponse<never> = { success: false, error: "Not found" };
      return NextResponse.json(body, { status: 404 });
    }

    const body: ApiResponse<{ person: PersonRow }> = { success: true, data: { person } };
    return NextResponse.json(body);
  } catch (err: any) {
    const body: ApiResponse<never> = {
      success: false,
      error: err?.message ?? "Unknown error",
    };
    return NextResponse.json(body, { status: 500 });
  }
}

