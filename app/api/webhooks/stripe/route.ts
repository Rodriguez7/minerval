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
      console.warn("[stripe-webhook] checkout.session.completed missing school_id metadata", event.id);
      return NextResponse.json({ received: true });
    }

    // Insert billing event for idempotency
    const { error: insertError } = await admin.from("billing_events").insert({
      school_id: schoolId,
      stripe_event_id: event.id,
      event_type: billingEventType,
      payload: event.data.object,
    });

    if (insertError && insertError.code !== "23505") {
      console.error("[stripe-webhook] billing_events insert failed", event.id, insertError.message);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    if (insertError?.code === "23505") {
      return NextResponse.json({ received: true });
    }

    const { error: updateError1 } = await admin
      .from("school_subscriptions")
      .update({
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
      })
      .eq("school_id", schoolId);
    if (updateError1) {
      console.error("[stripe-webhook] school_subscriptions update failed", event.id, updateError1.message);
    }

    return NextResponse.json({ received: true });
  }

  // For all other event types: look up school_id first, then insert billing_events, then process
  const obj = event.data.object as { customer: string };

  // Look up school_id by stripe_customer_id (1st DB call)
  const { data: subData } = await admin
    .from("school_subscriptions")
    .select("school_id")
    .eq("stripe_customer_id", obj.customer)
    .single();

  const schoolId = subData?.school_id ?? null;

  if (!schoolId) {
    console.warn("[stripe-webhook] Could not resolve school_id for event", event.id);
    return NextResponse.json({ received: true });
  }

  // Insert billing event for idempotency (2nd DB call)
  const { error: insertError } = await admin.from("billing_events").insert({
    school_id: schoolId,
    stripe_event_id: event.id,
    event_type: billingEventType,
    payload: event.data.object,
  });

  if (insertError && insertError.code !== "23505") {
    console.error("[stripe-webhook] billing_events insert failed", event.id, insertError.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (insertError?.code === "23505") {
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
    const planCode = priceIdToPlanCode(priceId);
    if (!planCode) {
      console.warn("[stripe-webhook] Unknown price ID, skipping plan update", priceId, event.id);
      return NextResponse.json({ received: true });
    }

    const { error: updateError2 } = await admin
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
    if (updateError2) {
      console.error("[stripe-webhook] school_subscriptions update failed", event.id, updateError2.message);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const { error: updateError3 } = await admin
      .from("school_subscriptions")
      .update({ status: "canceled" })
      .eq("school_id", schoolId);
    if (updateError3) {
      console.error("[stripe-webhook] school_subscriptions update failed", event.id, updateError3.message);
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as { period_end: number };
    const { error: updateError4 } = await admin
      .from("school_subscriptions")
      .update({
        status: "active",
        current_period_end: invoice.period_end
          ? new Date(invoice.period_end * 1000).toISOString()
          : null,
      })
      .eq("school_id", schoolId);
    if (updateError4) {
      console.error("[stripe-webhook] school_subscriptions update failed", event.id, updateError4.message);
    }
  }

  if (event.type === "invoice.payment_failed") {
    const { error: updateError5 } = await admin
      .from("school_subscriptions")
      .update({ status: "past_due" })
      .eq("school_id", schoolId);
    if (updateError5) {
      console.error("[stripe-webhook] school_subscriptions update failed", event.id, updateError5.message);
    }
  }

  return NextResponse.json({ received: true });
}
