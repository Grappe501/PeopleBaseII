import { MobileTopBar } from "@/components/field/mobile-topbar";
import { ResultClient } from "@/app/field/mobile/contact/[contactId]/result/result-client";

export const dynamic = "force-dynamic";

export default async function ContactResultPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const contactIdNum = Number(contactId);
  return (
    <>
      <MobileTopBar
        title="Result"
        left={<span className="text-xs text-slate-400">Contact {contactId}</span>}
        right={<span className="text-xs text-emerald-300/90">Synced</span>}
      />
      {Number.isFinite(contactIdNum) && contactIdNum > 0 ? (
        <ResultClient contactId={contactIdNum} />
      ) : (
        <div className="px-4 py-5">
          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">
            Invalid contact id.
          </div>
        </div>
      )}
    </>
  );
}

