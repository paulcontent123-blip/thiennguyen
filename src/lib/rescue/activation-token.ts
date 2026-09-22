import "server-only";

import { createHash, randomBytes } from "node:crypto";

const ACTIVATION_TOKEN_BYTES = 32;

export function hashRescueActivationToken(token: string) {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function createRescueActivationToken() {
  const token = randomBytes(ACTIVATION_TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashRescueActivationToken(token),
  };
}
