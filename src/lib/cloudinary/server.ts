import "server-only";

import { createHash } from "node:crypto";

type CloudinaryUpload = {
  secureUrl: string;
  publicId: string;
};

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary chưa được cấu hình đầy đủ trên server.");
  }

  return { cloudName, apiKey, apiSecret };
}

function signature(params: Record<string, string>, apiSecret: string) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

export async function uploadToCloudinary(file: File, assetFolder: string, publicId: string): Promise<CloudinaryUpload> {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams = { asset_folder: assetFolder, public_id: publicId, timestamp };
  const body = new FormData();
  body.set("file", file, file.name);
  body.set("api_key", apiKey);
  body.set("timestamp", timestamp);
  body.set("asset_folder", assetFolder);
  body.set("public_id", publicId);
  body.set("signature", signature(signedParams, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });
  const result = (await response.json()) as { secure_url?: string; public_id?: string; error?: { message?: string } };

  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(result.error?.message || "Không thể upload tệp lên Cloudinary.");
  }

  return { secureUrl: result.secure_url, publicId: result.public_id };
}

export async function destroyCloudinaryAsset(publicId: string | null | undefined) {
  if (!publicId) return;
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams = { public_id: publicId, timestamp };
  const body = new FormData();
  body.set("public_id", publicId);
  body.set("api_key", apiKey);
  body.set("timestamp", timestamp);
  body.set("signature", signature(signedParams, apiSecret));

  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body,
  });
}

export function buildCloudinaryDerivedImageUrl(publicId: string, transformation = "c_fill,w_1080,h_1920,g_auto,q_auto,f_auto") {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) throw new Error("Cloudinary chưa được cấu hình trên server.");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`;
}
