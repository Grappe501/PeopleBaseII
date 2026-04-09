import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types/contracts/api";
import type {
  AddConsentEventInput,
  PersonCompliancePayload,
  UpsertSuppressionInput,
} from "@/lib/types/contracts/compliance";
import { getPersonCompliance } from "@/lib/queries/compliance";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ personId: string }> },
): Promise<NextResponse<ApiResponse<PersonCompliancePayload>>> {
  try {
    const { personId } = await ctx.params;
    if (!isUuid(personId)) {
      return NextResponse.json({ success: false, error: "Invalid personId (expected UUID)." }, { status: 400 });
    }
    const channels = await getPersonCompliance(personId);
    return NextResponse.json({ success: true, data: { personId, channels } });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ personId: string }> },
): Promise<NextResponse<ApiResponse<{ ok: true }>>> {
  try {
    const { personId } = await ctx.params;
    if (!isUuid(personId)) {
      return NextResponse.json({ success: false, error: "Invalid personId (expected UUID)." }, { status: 400 });
    }
    const body = (await req.json()) as
      | { kind: "add_consent_event"; input: AddConsentEventInput }
      | { kind: "upsert_suppression"; input: UpsertSuppressionInput };

    if (!body || typeof body !== "object" || !("kind" in body)) {
      return NextResponse.json({ success: false, error: "Missing request body." }, { status: 400 });
    }

    if (body.kind === "add_consent_event") {
      const input = body.input;
      if (!input || input.personId !== personId) {
        return NextResponse.json({ success: false, error: "personId mismatch." }, { status: 400 });
      }
      await sql`
        insert into public.compliance_consent_events (
          person_id,
          contact_type,
          contact_value,
          contact_value_sha256,
          channel,
          consent_status,
          source,
          evidence,
          occurred_at
        ) values (
          ${personId}::uuid,
          ${input.contactType},
          ${input.contactValue ?? null},
          case
            when ${input.contactValue ?? null} is null then null
            else encode(digest(lower(btrim(${input.contactValue ?? ""})), 'sha256'), 'hex')
          end,
          ${input.channel},
          ${input.consentStatus},
          ${input.source ?? "manual"},
          ${input.evidence ?? null},
          coalesce(${input.occurredAt ?? null}::timestamptz, now())
        )
      `;
      return NextResponse.json({ success: true, data: { ok: true } });
    }

    if (body.kind === "upsert_suppression") {
      const input = body.input;
      if (!input || input.personId !== personId) {
        return NextResponse.json({ success: false, error: "personId mismatch." }, { status: 400 });
      }

      const contactType = input.channel === "email" ? "email" : "phone";

      // v1: insert a new active suppression row (we keep history by design).
      await sql`
        insert into public.compliance_suppressions (
          person_id,
          contact_type,
          contact_value,
          contact_value_sha256,
          channel,
          suppression_reason,
          suppression_source,
          starts_at,
          ends_at,
          note
        ) values (
          ${personId}::uuid,
          ${contactType},
          null,
          null,
          ${input.channel},
          ${input.suppressionReason},
          'manual',
          now(),
          ${input.endsAt ?? null}::timestamptz,
          ${input.note ?? null}
        )
      `;

      return NextResponse.json({ success: true, data: { ok: true } });
    }

    return NextResponse.json({ success: false, error: "Unknown kind." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

