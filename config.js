export const config = {
  nhsEnvironment: process.env.NHS_ENVIRONMENT,
  mhsInboundUrl: process.env.MHS_INBOUND_URL,
  repoToGpAuthKeys: process.env.REPO_TO_GP_AUTHORIZATION_KEYS,
  ehrRepoAuthKeys: process.env.EHR_REPO_AUTHORIZATION_KEYS,
  queueUrl: process.env.QUEUE_URL,
  queueUsername: process.env.QUEUE_USERNAME,
  queuePassword: process.env.QUEUE_PASSWORD,
};
