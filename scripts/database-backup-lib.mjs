export function parseDatabaseUrl(value, name) {
  if (!value) throw new Error(`Missing ${name}`);
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${name} must be a PostgreSQL URL`);
  }
  if (!url.hostname || !url.username || !url.pathname.slice(1)) {
    throw new Error(`${name} is incomplete`);
  }
  return url;
}

export function postgresConnection(url) {
  return {
    args: [
      "--host",
      url.hostname,
      "--port",
      url.port || "5432",
      "--username",
      decodeURIComponent(url.username),
      "--dbname",
      decodeURIComponent(url.pathname.slice(1)),
    ],
    env: {
      PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: url.searchParams.get("sslmode") || "require",
    },
  };
}

export function assertSafeRestoreTarget(restoreUrl, productionUrl, options = {}) {
  if (options.confirmation !== "RESTORE_TO_DISPOSABLE_DATABASE") {
    throw new Error("Set RESTORE_CONFIRMATION=RESTORE_TO_DISPOSABLE_DATABASE");
  }

  if (productionUrl) {
    const sameHost = restoreUrl.hostname === productionUrl.hostname;
    const sameDatabase = restoreUrl.pathname === productionUrl.pathname;
    if (sameHost && sameDatabase) {
      throw new Error("Refusing to restore into the production database");
    }
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(restoreUrl.hostname) && options.allowRemote !== "yes") {
    throw new Error("Remote restore tests require ALLOW_REMOTE_RESTORE_TEST=yes");
  }
}
