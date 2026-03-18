import Link from "next/link";

export default function OnboardingDonePage() {
  return (
    <div className="bg-white rounded-xl shadow p-8 text-center space-y-6">
      <div className="text-5xl">🎉</div>
      <div>
        <h1 className="text-2xl font-bold">You&apos;re all set!</h1>
        <p className="text-gray-500 mt-2 text-sm">
          Your school is ready. Share your payment QR code with parents to start
          collecting fees.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-block bg-blue-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
