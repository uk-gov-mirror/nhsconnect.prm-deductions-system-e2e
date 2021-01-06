import axios from 'axios';
import adapter from 'axios/lib/adapters/http';
import { v4 } from 'uuid';
import { config } from "../config";
import { generateEhrExtractResponse } from './ehr-extract-template';

export const addRecordToEhrRepo = async nhsNumber => {
  const ehrRepoUrl = `https://${config.nhsEnvironment}.ehr-repo.patient-deductions.nhs.uk`;
  const ehrRepoKey = config.ehrRepoAuthKeys;

  //Post /fragments to get the pre-signed url for s3
  const conversationId = v4().toUpperCase();
  const messageId = v4().toUpperCase();
  console.log('Conversation ID', conversationId);
  console.log('Message ID', messageId);

  const createEntryInEhrRepoData = {
    nhsNumber,
    conversationId,
    isLargeMessage: false,
    messageId,
    manifest: []
  };
  const generateS3UrlResp = await axios.post(`${ehrRepoUrl}/fragments`, createEntryInEhrRepoData, {
    headers: {
      Authorization: ehrRepoKey
    },
    adapter
  });
  const s3Url = generateS3UrlResp.data;
  console.log('Pre-signed url', s3Url);
  const gp2gpMessage = generateEhrExtractResponse(nhsNumber, conversationId, messageId);

  // Put to s3 via the pre-signed url
  const s3Resp = await axios.put(s3Url, gp2gpMessage, { adapter });
  if (s3Resp.status > 299) {
    console.log('Saving to s3 failed');
    return;
  }
  // Patch /fragments to mark it as complete
  const patchResp = await axios.patch(
    `${ehrRepoUrl}/fragments`,
    { conversationId, transferComplete: true },
    {
      headers: {
        Authorization: ehrRepoKey
      },
      adapter
    }
  );

  console.log('Patch response status', patchResp.status);
};
