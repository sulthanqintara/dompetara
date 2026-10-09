import assert from "node:assert/strict";
import { getLimiterSecret } from "../src/lib/security/get-limiter-secret.ts";

const authSecret = "offline-authentication-secret-32-characters";
const limiterSecret = "offline-separate-limiter-secret-32-characters";
assert.equal(getLimiterSecret({ BETTER_AUTH_SECRET: authSecret }), authSecret);
assert.equal(getLimiterSecret({ BETTER_AUTH_SECRET: authSecret, SECURITY_LIMITER_SECRET: "" }), authSecret, "An empty optional setting follows the documented auth-secret fallback");
assert.equal(getLimiterSecret({ BETTER_AUTH_SECRET: authSecret, SECURITY_LIMITER_SECRET: limiterSecret }), limiterSecret);
assert.throws(() => getLimiterSecret({}), /configuration is invalid/);
assert.throws(() => getLimiterSecret({ BETTER_AUTH_SECRET: "short" }), /configuration is invalid/);
assert.throws(() => getLimiterSecret({ BETTER_AUTH_SECRET: authSecret, SECURITY_LIMITER_SECRET: "short" }), /configuration is invalid/, "An invalid explicit secret fails closed");
console.log("Security configuration checks passed: optional secret fallback and invalid configuration fails closed.");
