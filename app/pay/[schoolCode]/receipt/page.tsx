import { redirect } from "next/navigation";

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  if (!ref) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No payment reference provided.</p>
      </main>
    );
  }

  redirect(`/pay/receipt?ref=${encodeURIComponent(ref)}`);
}
