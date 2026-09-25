const OPTIMIZED_REMOTE_IMAGE_HOSTS = new Set([
  "res.cloudinary.com",
  "img.vietqr.io",
]);

/**
 * Keep Next.js image optimization limited to explicitly trusted hosts.
 * Campaign media may also use an arbitrary HTTPS URL; those images are still
 * rendered by next/image, but bypass the optimizer to avoid a runtime host error.
 */
export function shouldBypassImageOptimization(src: string) {
  if (src.startsWith("/")) return false;

  try {
    const url = new URL(src);
    return url.protocol !== "https:" || !OPTIMIZED_REMOTE_IMAGE_HOSTS.has(url.hostname);
  } catch {
    return true;
  }
}
