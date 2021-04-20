import axios from 'axios';
import adapter from 'axios/lib/adapters/http';
import { v4 } from 'uuid';
import { config } from '../config';
import { addRecordToEhrRepo } from '../utils/add-record-to-ehr-repo';
import { emisEhrRequestTemplate } from './data/emis-ehr-request';
import { connectToQueueAndAssert } from '../utils/queue/handle-queue';

const ehrRepoUrl = `https://${config.nhsEnvironment}.ehr-repo.patient-deductions.nhs.uk`;
const repoToGpUrl = `https://${config.nhsEnvironment}.repo-to-gp.patient-deductions.nhs.uk`;

describe('EMIS registration requests', () => {
  const RETRY_COUNT = 40;
  const POLLING_INTERVAL_MS = 500;
  const TEST_TIMEOUT = 3 * RETRY_COUNT * POLLING_INTERVAL_MS;

  it(
    'should capture a registration request',
    async done => {
      const testData = {
        dev: {
          odsCode: 'A91720',
          nhsNumber: '9692842304'
        },
        test: {
          odsCode: 'N82668',
          nhsNumber: '9692295281'
        }
      };

      // Setup: add an EHR to the repo
      const { nhsNumber, odsCode } = testData[config.nhsEnvironment];
      const EHR_EXTRACT_INTERACTION_ID = 'RCMR_IN030000UK06';

      try {
        await axios.get(`${ehrRepoUrl}/patients/${nhsNumber}`, {
          headers: { Authorization: config.ehrRepoAuthKeys },
          adapter
        });
        console.log('EHR found for patient:', nhsNumber);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          await addRecordToEhrRepo(nhsNumber);
        }
      }

      // Action: send an EHR request to MHS Adapter inbound
      const conversationId = v4();
      const ehrRequest = generateEhrRequest(conversationId, nhsNumber, odsCode);

      const headers = {
        Soapaction: 'urn:nhs:names:services:gp2gp/RCMR_IN010000UK05',
        'Content-Type':
          'multipart/related;charset="UTF-8";type="text/xml";boundary="0adedbcc-ed0f-415d-8091-4e816bf9d86f";start="<ContentRoot>"'
      };

      await axios
        .post(config.mhsInboundUrl, ehrRequest, { headers: headers, adapter })
        .catch(() => {
          console.log("MHS can't handle this message so it returns with 500");
        });

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

      if (config.useTestHarness) {
        connectToQueueAndAssert(body => {
          expect(body).toContain(nhsNumber);
          expect(body).toContain(EHR_EXTRACT_INTERACTION_ID);
          expect(body).toContain(conversationId);
          done();
        });
      }
      done();
    },
    TEST_TIMEOUT
  );
});

const generateEhrRequest = (conversationId, nhsNumber, odsCode) => {
  return emisEhrRequestTemplate
    .replace('${conversationId}', conversationId)
    .replace('${nhsNumber}', nhsNumber)
    .replace('${odsCode}', odsCode);
};

const getRegistrationDetails = async conversationId => {
  try {
    const registrationDetailsResp = await axios.get(
      `${repoToGpUrl}/registration-requests/${conversationId}`,
      {
        headers: { Authorization: config.repoToGpAuthKeys },
        adapter
      }
    );
    return registrationDetailsResp.data.data.attributes;
  } catch (err) {
    console.log(err);
    return {};
  }
};

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
