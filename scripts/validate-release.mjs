import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const vercel = JSON.parse(read("vercel.json"));
const envExample = read(".env.example");
const apiRoute = read("app/api/reconcile/route.ts");
const serverAuth = read("lib/pocketbiServerAuth.ts");
const page = read("app/page.tsx");
const health = read("app/api/health/route.ts");

const PLATFORM_REF = "bozkwngfioubgwzvzfif";

assert.equal(
  pkg.dependencies.xlsx,
  "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
  "Reconcile must use the current SheetJS distribution rather than the stale npm xlsx package.",
);
assert.match(envExample, new RegExp(`https://${PLATFORM_REF}\\.supabase\\.co`));
assert.match(envExample, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
assert.doesNotMatch(envExample, /service_role|SERVICE_ROLE/i, "Public deployment docs must not request a service-role key.");

assert.match(apiRoute, /const EXPORT_CAPABILITY = "reconcile\.full_export"/);
assert.match(apiRoute, /checkOptionalCapability\(request, EXPORT_CAPABILITY\)/);
assert.match(apiRoute, /reconciliation\.report\.slice\(0, FREE_PREVIEW_ROWS\)/);
assert.match(apiRoute, /discrepancyCsv: access\.allowed/);
assert.match(apiRoute, /const MAX_FILE_BYTES = 12 \* 1024 \* 1024/);
assert.match(page, /12 MB per file/);
assert.match(page, /No account required/);

assert.match(serverAuth, /client\.auth\.getUser\(token\)/);
assert.match(serverAuth, /client\.rpc\("has_entitlement"/);
assert.doesNotMatch(serverAuth, /service_role|SERVICE_ROLE/i);

assert.match(health, new RegExp(PLATFORM_REF));
assert.match(health, /identityAuthorityCorrect/);
assert.match(health, /status: healthy \? 200 : 503/);

assert.equal(vercel.git?.deploymentEnabled?.["agent/**"], false);
assert.equal(vercel.git?.deploymentEnabled?.["chore/**"], false);
assert.notEqual(vercel.git?.deploymentEnabled?.main, false, "main must remain deployable.");

console.log("PocketBI Reconcile release contract validated.");
