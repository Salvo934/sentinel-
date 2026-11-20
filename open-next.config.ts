// OpenNext adapter config for Cloudflare Workers.
// No incremental cache is configured: the app does not use ISR/static
// revalidation (Cache Components is disabled, pages are per-session).
// See https://opennext.js.org/cloudflare/caching before enabling one.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
