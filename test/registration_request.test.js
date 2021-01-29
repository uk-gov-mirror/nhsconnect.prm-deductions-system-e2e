import axios from 'axios';
import adapter from 'axios/lib/adapters/http';
import { v4 } from 'uuid';
import { config } from '../config';
import { addRecordToEhrRepo } from '../utils/add-record-to-ehr-repo';
import {
  generateEmisEhrRequestTemplateInbound,
  generateEmisEhrRequestTemplateOutbound
} from './data/emis-ehr-request';

describe('EMIS registration requests', () => {
  const RETRY_COUNT = 20;
  const POLLING_INTERVAL_MS = 500;
  const TEST_TIMEOUT = 3 * RETRY_COUNT * POLLING_INTERVAL_MS;

  it(
    'should capture a registration request',
    async () => {
      const testData = {
        dev: {
          odsCode: 'A91720',
          asid: '918999198820',
          nhsNumber: '9692842304',
          repoOdsCode: 'A91521'
        },
        test: {
          odsCode: 'N82668',
          nhsNumber: '9692295281'
        }
      };

      // Setup: add an EHR to the repo
      const ehrRepoUrl = `https://${config.nhsEnvironment}.ehr-repo.patient-deductions.nhs.uk`;
      const { nhsNumber, odsCode, repoOdsCode, asid } = testData[config.nhsEnvironment];
      const ehrRepoKey = config.ehrRepoAuthKeys;

      try {
        await axios.get(`${ehrRepoUrl}/patients/${nhsNumber}`, {
          headers: { Authorization: ehrRepoKey },
          adapter
        });
        console.log('EHR found for patient:', nhsNumber);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          await addRecordToEhrRepo(nhsNumber);
        }
      }

      const conversationId = v4();
      const interactionId = 'RCMR_IN010000UK05';

      // Action: send an EHR request to MHS Adapter inbound/ test harness MHS outbound
      if (config.useTestHarness === 'true') {
        const mhsOutboundTestHarnessUrl = config.mhsOutboundTestHarnessUrl;
        const headers = {
          'Content-Type': 'application/json',
          'Interaction-ID': interactionId,
          'Sync-Async': false,
          'Correlation-Id': conversationId,
          // who will send the record - repo
          'Ods-Code': repoOdsCode,
          // who is requesting the record - test-harness
          'from-asid': asid
        };

        const ehrRequest = generateEmisEhrRequestTemplateOutbound(
          conversationId,
          nhsNumber,
          odsCode,
          asid
        );

        const body = {
          payload: ehrRequest
        };

        await axios
          .post(mhsOutboundTestHarnessUrl, body, { headers: headers, adapter })
          .catch(e => {
            console.log('Sending EHR request to test harness MHS outbound failed', e);
          });
      } else {
        const mhsInboundUrl = config.mhsInboundUrl;
        const headers = {
          Soapaction: interactionId,
          'Content-Type':
            'multipart/related;charset="UTF-8";type="text/xml";boundary="0adedbcc-ed0f-415d-8091-4e816bf9d86f";start="<ContentRoot>"'
        };

        const ehrRequest = generateEmisEhrRequestTemplateInbound(
          conversationId,
          nhsNumber,
          odsCode,
          asid
        );

        await axios.post(mhsInboundUrl, ehrRequest, { headers: headers, adapter }).catch(e => {
          console.log("MHS can't handle this message so it returns with 500", e);
        });
      }

      console.log('ConversationId:', conversationId);

      let registrationStatus;
      const expectedStatus = 'sent_ehr';
      for (let i = 0; i < RETRY_COUNT; i++) {
        const registrationDetails = await getRegistrationDetails(conversationId);
        registrationStatus = registrationDetails.status;
        console.log(`try: ${i} - status: ${registrationStatus}`);

        if (registrationStatus === expectedStatus) {
          break;
        }
        await sleep(POLLING_INTERVAL_MS);
      }

      expect(registrationStatus).toEqual(expectedStatus);
    },
    TEST_TIMEOUT
  );
});

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const getRegistrationDetails = async conversationId => {
  const repoToGpUrl = `https://${config.nhsEnvironment}.repo-to-gp.patient-deductions.nhs.uk`;
  const repoToGpAuthKeys = config.repoToGpAuthKeys;

  try {
    const res = await axios.get(`${repoToGpUrl}/registration-requests/${conversationId}`, {
      headers: { Authorization: repoToGpAuthKeys },
      adapter
    });
    return res.data.data.attributes;
  } catch (err) {
    console.log(err.response.status);
    return {};
  }
};
