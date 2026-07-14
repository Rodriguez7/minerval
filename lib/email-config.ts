const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function extractEmailAddress(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const bracketed = trimmed.match(/<([^<>]+)>$/)?.[1]?.trim();
  const address = (bracketed ?? trimmed).toLowerCase();
  return EMAIL_PATTERN.test(address) ? address : null;
}

export function getEmailSender() {
  const sender = process.env.EMAIL_FROM?.trim();
  if (!sender || !extractEmailAddress(sender)) {
    throw new Error("Missing or invalid EMAIL_FROM");
  }
  return sender;
}

export function getEmailConfigurationIssues(environment = process.env) {
  const issues: string[] = [];
  const expectedDomain = environment.EMAIL_DOMAIN?.trim().toLowerCase();
  const sender = extractEmailAddress(environment.EMAIL_FROM);

  if (!expectedDomain) return ["EMAIL_DOMAIN is missing"];
  if (!sender) {
    issues.push("EMAIL_FROM is invalid");
  } else if (!sender.endsWith(`@${expectedDomain}`)) {
    issues.push("EMAIL_FROM does not use EMAIL_DOMAIN");
  }

  for (const name of ["LEGAL_CONTACT_EMAIL", "PRIVACY_CONTACT_EMAIL"] as const) {
    const address = extractEmailAddress(environment[name]);
    if (!address) {
      issues.push(`${name} is invalid`);
    } else if (!address.endsWith(`@${expectedDomain}`)) {
      issues.push(`${name} does not use EMAIL_DOMAIN`);
    }
  }

  return issues;
}
