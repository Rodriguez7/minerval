import { NextResponse } from "next/server";
import { stripe, priceIdToPlanCode } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase";

// Must NOT be cached — webhooks are real-time events
export const dynamic = "force-dynamic";

// Stripe requires the raw body (not parsed JSON) for signature verification
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getAdminClient();

  // Map Stripe event type to internal billing_events.event_type
  const billingEventTypeMap: Record<string, string> = {
    "checkout.session.completed": "stripe.subscription.created",
    "customer.subscription.updated": "stripe.subscription.updated",
    "customer.subscription.deleted": "stripe.subscription.deleted",
    "invoice.paid": "stripe.invoice.paid",
    "invoice.payment_failed": "stripe.invoice.payment_failed",
  };

  const billingEventType = billingEventTypeMap[event.type];
  if (!billingEventType) {
    // Unknown event type — acknowledge but don't process
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      customer: string;
      subscription: string;
      metadata: { school_id?: string };
    };
    const schoolId = session.metadata?.school_id ?? null;

    if (!schoolId) {
      console.warn("[stripe-webhook] Could not resolve school_id for event", event.id);
      return NextResponse.json({ received: true });
    }

    // Insert billing event for idempotency
    const { error: insertError } = await admin.from("billing_events").insert({
      school_id: schoolId,
      stripe_event_id: event.id,
      event_type: billingEventType,
      payload: event.data.object,
    });

    if (insertError?.code === "23505") {
      // Already processed this event (duplicate delivery from Stripe)
      return NextResponse.json({ received: true });
    }

    await admin
      .from("school_subscriptions")
      .update({
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
      })
      .eq("school_id", schoolId);

    return NextResponse.json({ received: true });
  }

  // For all other event types: insert billing_events first, then look up school_id, then process

  // Insert billing event for idempotency (school_id resolved after for non-checkout events)
  const obj = event.data.object as { customer: string };

  const { error: insertError } = await admin.from("billing_events").insert({
    stripe_customer_id: obj.customer,
    stripe_event_id: event.id,
    event_type: billingEventType,
    payload: event.data.object,
  });

  if (insertError?.code === "23505") {
    // Already processed this event (duplicate delivery from Stripe)
    return NextResponse.json({ received: true });
  }

  // Look up school_id by stripe_customer_id
  const { data } = await admin
    .from("school_subscriptions")
    .select("school_id")
    .eq("stripe_customer_id", obj.customer)
    .single();

  const schoolId = data?.school_id ?? null;

  if (!schoolId) {
    console.warn("[stripe-webhook] Could not resolve school_id for event", event.id);
    return NextResponse.json({ received: true });
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as {
      customer: string;
      status: string;
      current_period_end: number;
      trial_end: number | null;
      items: { data: Array<{ price: { id: string } }> };
    };
    const priceId = sub.items.data[0]?.price.id ?? "";
    const planCode = priceIdToPlanCode(priceId) ?? "starter_free";

    await admin
      .from("school_subscriptions")
      .update({
        status: sub.status,
        plan_code: planCode,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        trial_ends_at: sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null,
      })
      .eq("school_id", schoolId);
  }

  if (event.type === "customer.subscription.deleted") {
    await admin
      .from("school_subscriptions")
      .update({ status: "canceled" })
      .eq("school_id", schoolId);
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as { period_end: number };
    await admin
      .from("school_subscriptions")
      .update({
        status: "active",
        current_period_end: invoice.period_end
          ? new Date(invoice.period_end * 1000).toISOString()
          : null,
      })
      .eq("school_id", schoolId);
  }

  if (event.type === "invoice.payment_failed") {
    await admin
      .from("school_subscriptions")
      .update({ status: "past_due" })
      .eq("school_id", schoolId);
  }

  return NextResponse.json({ received: true });
}
