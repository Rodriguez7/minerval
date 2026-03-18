import Link from "next/link";

type Props = {
  title?: string;
  description?: string;
};

export function InactivePaymentLink({
  title = "Payment Link Updated",
  description = "This school payment link is no longer active. Please scan the latest QR code or request the current payment link from your school.",
}: Props) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xl font-semibold">
          !
        </div>
        <h1 className="text-2xl font-bold mb-3">{title}</h1>
        <p className="text-sm leading-6 text-gray-600">{description}</p>
        <div className="mt-6">
          <Link
            href="/pay"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Return to Payment Help
          </Link>
        </div>
      </div>
    </main>
  );
}
