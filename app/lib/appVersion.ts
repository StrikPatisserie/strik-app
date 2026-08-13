export function getAppVersion() {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    "development"
  );
}

export function appVersionCanAutoRefresh(version: string) {
  return version !== "development";
}
