export const config = {
  nhsEnvironment: process.env.NHS_ENVIRONMENT,
  mhsInboundUrl: process.env.MHS_INBOUND_URL,
  repoToGpAuthKeys: process.env.REPO_TO_GP_AUTHORIZATION_KEYS,
  ehrRepoAuthKeys: process.env.EHR_REPO_AUTHORIZATION_KEYS,
  useTestHarness: process.env.USE_TEST_HARNESS,
  mhsOutboundTestHarnessUrl: process.env.MHS_OUTBOUND_TEST_HARNESS_URL
};
