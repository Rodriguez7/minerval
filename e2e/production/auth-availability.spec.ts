import { expect, test } from "@playwright/test";

/**
 * Runs against real production, not a local build.
 *
 * Covers the failure class that unit tests, the build, and the deep health
 * check are all structurally blind to: the server is healthy and every env var
 * is set, but the browser refuses to run something the page depends on, so a
 * gated submit button never becomes usable and nobody can sign in.
 *
 * Every assertion here is deliberately independent of whether Cloudflare
 * decides to challenge the visitor. Turnstile does challenge headless browsers
 * from datacenter IPs, so asserting that a token arrives — or that a captcha-
 * gated button becomes enabled — fails from CI even when production is
 * perfectly healthy. A monitor that cries wolf gets muted, so this asserts only
 * what is invariant for every visitor.
 */

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const AUTH_FORMS = [
  { path: "/en/login", submit: "Sign in" },
  { path: "/en/signup", submit: "Create account" },
  { path: "/en/forgot-password", submit: "Send reset link" },
] as const;

function directive(csp: string, name: string) {
  return csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name);
}

for (const form of AUTH_FORMS) {
  /**
   * Deterministic and timing-free: compares the page's own markup against the
   * header it was served with. If the page loads a script its CSP forbids, the
   * form is already broken for every visitor. Fails without waiting on the
   * network, the widget, or a challenge decision.
   */
  test(`${form.path} never ships a script its own CSP forbids`, async ({ page }) => {
    const response = await page.goto(form.path);
    expect(response?.status(), `${form.path} should load`).toBe(200);

    const csp = response?.headers()["content-security-policy"] ?? "";
    expect(csp, "a CSP should be served").not.toBe("");

    const html = await page.content();
    if (!html.includes(TURNSTILE_ORIGIN)) {
      // Captcha is switched off (no site key). Nothing to reconcile.
      return;
    }

    expect(
      directive(csp, "script-src"),
      `${form.path} loads Turnstile from ${TURNSTILE_ORIGIN} but script-src forbids it, ` +
        `so the widget can never render and the submit button stays disabled forever`
    ).toContain(TURNSTILE_ORIGIN);

    // The widget renders in an iframe and calls home to verify. Both are
    // separately blockable, and each fails just as silently as script-src.
    expect(
      directive(csp, "frame-src"),
      "frame-src must exist and permit Turnstile, or it silently inherits default-src 'self' " +
        "and the widget iframe is blocked"
    ).toContain(TURNSTILE_ORIGIN);

    expect(
      directive(csp, "connect-src"),
      "connect-src must permit Turnstile's verification calls"
    ).toContain(TURNSTILE_ORIGIN);
  });

  /**
   * The runtime counterpart. window.turnstile is the signal that inverted
   * during the outage: the script tag was present, but the script never ran, so
   * no token could ever be produced. Unlike a token, this does not depend on
   * whether the visitor gets challenged.
   */
  test(`${form.path} has a working submit path`, async ({ page }) => {
    await page.goto(form.path);

    const submit = page.getByRole("button", { name: form.submit });
    await expect(submit).toBeVisible();

    const captchaActive = (await page.content()).includes(TURNSTILE_ORIGIN);

    if (!captchaActive) {
      // No captcha gate, so there is nothing to wait for: a visitor who cannot
      // click here cannot sign in at all.
      await expect(submit, "with no captcha the button must be usable immediately").toBeEnabled();
      return;
    }

    await expect
      .poll(() => page.evaluate(() => typeof (window as { turnstile?: unknown }).turnstile), {
        timeout: 20_000,
        message:
          "the Turnstile script never executed: it is referenced by the page but window.turnstile " +
          "stayed undefined, so it was blocked rather than merely slow. Every captcha-gated " +
          "submit button is therefore permanently disabled and nobody can sign in.",
      })
      .toBe("object");

    // The widget must also mount. Turnstile may then either auto-issue a token
    // or challenge, and both are healthy, so the outcome is not asserted.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document.querySelectorAll(
                'iframe[src*="challenges.cloudflare.com"], [name^="cf-turnstile"]'
              ).length
          ),
        {
          timeout: 20_000,
          message: "the Turnstile script ran but never mounted a widget",
        }
      )
      .toBeGreaterThan(0);
  });
}

/**
 * A blocked script is invisible server-side, but a 5xx on the page itself is
 * not. Cheap, and it costs one request each.
 */
test("public entry points respond", async ({ request }) => {
  for (const path of ["/en", "/en/pay", "/api/health"]) {
    const response = await request.get(path);
    expect(response.status(), `${path} should respond 200`).toBe(200);
  }
});
