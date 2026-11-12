import type { NextConfig } from "next";
import {randomUUID} from 'node:crypto';

// Public release marker, frozen into this build. The fallback also supports
// deployments where provider system variables are disabled.
const productionRelease=process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || (process.env.NODE_ENV==='production'?randomUUID():'development');

const nextConfig: NextConfig = {
  env:{NEXT_PUBLIC_STRIK_RELEASE:productionRelease},
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist", "heic-decode"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  outputFileTracingIncludes: {
    "/api/recepturen/import": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
};

export default nextConfig;
