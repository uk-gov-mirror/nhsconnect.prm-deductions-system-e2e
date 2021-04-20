import axios from 'axios';
import { config } from '../config';
import adapter from 'axios/lib/adapters/http';
import { v4, v4 as uuid } from 'uuid';
import { connectToQueueAndAssert } from '../utils/queue/handle-queue';
import { largeHealthRecordExtractTemplate } from './data/large-ehr-extract';

const gpToRepoUrl = `https://${config.nhsEnvironment}.gp-to-repo.patient-deductions.nhs.uk`;
const ehrRepoUrl = `https://${config.nhsEnvironment}.ehr-repo.patient-deductions.nhs.uk`;
const gp2gpAdaptor = `https://${config.nhsEnvironment}.gp2gp-adaptor.patient-deductions.nhs.uk`;

describe('Deduction request', () => {
  const RETRY_COUNT = 40;
  const POLLING_INTERVAL_MS = 500;
  const TEST_TIMEOUT = 3 * RETRY_COUNT * POLLING_INTERVAL_MS;

  if (config.useTestHarness) {
    it(
      'should send continue message when large health record extract received',
      async done => {
        const nhsNumber = '9692842312';
        const testHarnessOdsCode = 'A91720';
        const CONTINUE_REQUEST_INTERACTION_ID = 'COPC_IN000001UK01';

        // Setup
        await assignPatientToOdsCode(nhsNumber, testHarnessOdsCode);
        console.log('Updated patients ods code to test harness ods code');

        await sleep(2000);

        // Action
        const deductionRequestResource = await makeDeductionRequest(nhsNumber);
        const conversationId = extractConversationIdFromDeductionRequestResource(
          deductionRequestResource
        );
        const messageId = v4();
        const attachmentId = v4();
        console.log(`Triggered deduction request, ConversationID: ${conversationId}`);

        const largeHealthRecordExtract = generateLargeHealthRecordExtract(
          conversationId,
          nhsNumber,
          testHarnessOdsCode,
          messageId,
          attachmentId
        );
        console.log('Generated large health record');

        // Add large message to MHS Inbound
        const headers = {
          Soapaction: 'urn:nhs:names:services:gp2gp/RCMR_IN030000UK06',
          'Content-Type':
            'multipart/related;charset="UTF-8";type="text/xml";boundary="2f5a95be-81e0-4f4a-b62f-88c3a02a697c";start="<ContentRoot>"'
        };

        await axios
          .post(config.mhsInboundUrl, largeHealthRecordExtract, { headers: headers, adapter })
          .catch(() => {
            console.log("MHS can't handle this message so it returns with 500");
          });

        console.log('Added health record to mhs inbound');

        await sleep(5000);

        // Wait for continue message in test harness queue
        connectToQueueAndAssert(body => {
          expect(body).toContain(CONTINUE_REQUEST_INTERACTION_ID);
          expect(body).toContain(conversationId.toUpperCase());
          done();
        });
      },
      TEST_TIMEOUT
    );
  } else {
    it(
      'should handle a deduction for a patient of TPP practice with the small Health Record',
      async () => {
        const nhsNumber = '9442964410';
        const tppOdsCode = 'M85019';

        // Setup
        await assignPatientToOdsCode(nhsNumber, tppOdsCode);

        let patientOdsCode;
        for (let i = 0; i < RETRY_COUNT; i++) {
          const patientPdsDetails = await getPatientPdsDetails(nhsNumber);
          patientOdsCode = patientPdsDetails.data.odsCode;

          console.log(`try: ${i} - status: ${patientOdsCode}`);

          if (patientOdsCode === tppOdsCode) {
            break;
          }
          await sleep(POLLING_INTERVAL_MS);
        }

        expect(patientOdsCode).toEqual(tppOdsCode);

        // Action
        const deductionRequestResource = await makeDeductionRequest(nhsNumber);
        const conversationId = extractConversationIdFromDeductionRequestResource(
          deductionRequestResource
        );
        console.log(`Triggered deduction request, ConversationID: ${conversationId}`);

        const expectedStatus = 'ehr_extract_received';
        let deductionRequestStatus;
        for (let i = 0; i < RETRY_COUNT; i++) {
          deductionRequestStatus = await getDeductionRequestStatus(
            nhsNumber,
            deductionRequestResource
          );
          console.log(`try: ${i} - status: ${deductionRequestStatus}`);

          if (deductionRequestStatus === expectedStatus) {
            break;
          }
          await sleep(POLLING_INTERVAL_MS);
        }
        expect(deductionRequestStatus).toBe(expectedStatus);
      },
      TEST_TIMEOUT
    );

    it(
      'should handle a deduction for a patient of EMIS practice with the large Health Record',
      async () => {
        const nhsNumber = '9692295427';
        const emisOdsCode = 'N82668';

        // Setup
        await assignPatientToOdsCode(nhsNumber, emisOdsCode);
        let patientOdsCode;
        for (let i = 0; i < RETRY_COUNT; i++) {
          const patientPdsDetails = await getPatientPdsDetails(nhsNumber);
          patientOdsCode = patientPdsDetails.data.odsCode;
          console.log(`try: ${i} - status: ${patientOdsCode}`);

          if (patientOdsCode === emisOdsCode) {
            break;
          }
          await sleep(POLLING_INTERVAL_MS);
        }
        expect(patientOdsCode).toEqual(emisOdsCode);

        // Action
        const deductionRequestResource = await makeDeductionRequest(nhsNumber);
        const conversationId = extractConversationIdFromDeductionRequestResource(
          deductionRequestResource
        );
        console.log('DeductionRequest conversationId:', conversationId);

        const expectedStatus = 'continue_message_sent';
        let deductionRequestStatus;
        for (let i = 0; i < RETRY_COUNT; i++) {
          deductionRequestStatus = await getDeductionRequestStatus(
            nhsNumber,
            deductionRequestResource
          );
          console.log(`try: ${i} - status: ${deductionRequestStatus}`);

          if (deductionRequestStatus === expectedStatus) {
            break;
          }
          await sleep(POLLING_INTERVAL_MS);
        }
        expect(deductionRequestStatus).toBe(expectedStatus);

        // Assertion: ehr-repo has the large EHR for the specific transfer
        let patientHealthRecordStatus;
        for (let i = 0; i < RETRY_COUNT; i++) {
          patientHealthRecordStatus = await getHealthRecordStatus(nhsNumber, conversationId);
          console.log(`try: ${i} - status: ${patientHealthRecordStatus}`);

          if (patientHealthRecordStatus === 200) {
            break;
          }
          await sleep(POLLING_INTERVAL_MS);
        }
        expect(patientHealthRecordStatus).toBe(200);

        const patientHealthRecord = await axios
          .get(`${ehrRepoUrl}/patients/${nhsNumber}`, {
            headers: {
              Authorization: config.ehrRepoAuthKeys
            },
            adapter
          })
          .catch(err => {
            console.log(err.response);
          });

        expect(patientHealthRecord.status).toBe(200);
        expect(patientHealthRecord.data.data.links['healthRecordExtract']).toBeDefined();
        expect(patientHealthRecord.data.data.links['attachments']).toHaveLength(2);
        expect(patientHealthRecord.data.data.links['attachments'][0]).toContain(conversationId);
      },
      TEST_TIMEOUT
    );
  }
});

const getPatientPdsDetails = async nhsNumber => {
  try {
    const pdsResponse = await axios.get(`${gp2gpAdaptor}/patient-demographics/${nhsNumber}/`, {
      headers: {
        Authorization: config.gp2gpAdaptorAuthKeys
      },
      adapter
    });

    return pdsResponse.data;
  } catch (err) {
    console.log(err.response);
    return undefined;
  }
};

const assignPatientToOdsCode = async (nhsNumber, odsCode) => {
  try {
    // Get the PDS info
    const pdsResponse = await getPatientPdsDetails(nhsNumber);

    // Update PDS
    const patchResponse = await axios.patch(
      `${gp2gpAdaptor}/patient-demographics/${nhsNumber}`,
      {
        pdsId: pdsResponse.data.patientPdsId,
        serialChangeNumber: pdsResponse.data.serialChangeNumber,
        newOdsCode: odsCode,
        conversationId: uuid()
      },
      {
        headers: {
          Authorization: config.gp2gpAdaptorAuthKeys
        },
        adapter
      }
    );
    expect(patchResponse.status).toBe(204);
  } catch (err) {
    console.log(err.response);
  }
};

const makeDeductionRequest = async nhsNumber => {
  try {
    const deductionRequest = await axios.post(
      `${gpToRepoUrl}/deduction-requests`,
      { nhsNumber },
      {
        headers: { Authorization: config.gpToRepoAuthKeys },
        adapter
      }
    );
    return deductionRequest.headers.location;
  } catch (err) {
    console.log('failed to make deduction request', err.response.status);
    return {};
  }
};

const getHealthRecordStatus = async (nhsNumber, conversationId) => {
  try {
    const patientHealthRecordResponse = await axios.get(
      `${ehrRepoUrl}/patients/${nhsNumber}/health-records/${conversationId}`,
      {
        headers: {
          Authorization: config.ehrRepoAuthKeys
        },
        adapter
      }
    );
    return patientHealthRecordResponse.status;
  } catch (err) {
    console.log(err.response.status);
    return undefined;
  }
};

const getDeductionRequestStatus = async (nhsNumber, deductionRequestResourceUrl) => {
  try {
    const deductionRequestResponse = await axios.get(deductionRequestResourceUrl, {
      headers: {
        Authorization: config.gpToRepoAuthKeys
      },
      adapter
    });

    return deductionRequestResponse.data.data.attributes.status;
  } catch (err) {
    console.log(err.response.status);
    return undefined;
  }
};

const extractConversationIdFromDeductionRequestResource = deductionRequestResource => {
  return deductionRequestResource.split('/deduction-requests/')[1];
};

const generateLargeHealthRecordExtract = (
  conversationId,
  nhsNumber,
  odsCode,
  messageId,
  attachmentId
) => {
  return largeHealthRecordExtractTemplate
    .replace('${conversationId}', conversationId)
    .replace('${nhsNumber}', nhsNumber)
    .replace('${odsCode}', odsCode)
    .replace('${messageId}', messageId)
    .replace('${attachmentId}', attachmentId);
};

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
