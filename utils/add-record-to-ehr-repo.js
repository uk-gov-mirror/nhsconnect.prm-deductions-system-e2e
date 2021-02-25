import axios from 'axios';
import adapter from 'axios/lib/adapters/http';
import { v4 } from 'uuid';
import { config } from '../config';
import { generateEhrExtractResponse } from './ehr-extract-template';

export const addRecordToEhrRepo = async nhsNumber => {
  const ehrRepoUrl = `https://${config.nhsEnvironment}.ehr-repo.patient-deductions.nhs.uk`;
  const ehrRepoKey = config.ehrRepoAuthKeys;

  // Testing uppercase IDs sanitization in ehr repo
  const conversationId = v4();
  const messageId = v4();
  console.log('Conversation ID', conversationId);
  console.log('Message ID', messageId);

  const generateS3UrlResp = await axios.get(
    `${ehrRepoUrl}/messages/${conversationId}/${messageId}`,
    {
      headers: {
        Authorization: ehrRepoKey
      },
      adapter
    }
  );
  const s3Url = generateS3UrlResp.data;
  console.log('Pre-signed url', s3Url);
  const gp2gpMessage = generateEhrExtractResponse(nhsNumber, conversationId, messageId);

  // Put to s3 via the pre-signed url
  const s3Resp = await axios.put(s3Url, gp2gpMessage, { adapter });
  if (s3Resp.status > 299) {
    console.log('Saving to s3 failed');
    return;
  }

  const postRequestBody = {
    data: {
      type: 'messages',
      id: messageId,
      attributes: {
        conversationId,
        messageType: 'ehrExtract',
        nhsNumber,
        attachmentMessageIds: []
      }
    }
  };

  const patchResp = await axios.post(`${ehrRepoUrl}/messages`, postRequestBody, {
    headers: {
      Authorization: ehrRepoKey
    },
    adapter
  });

  console.log('Patch response status', patchResp.status);
};
