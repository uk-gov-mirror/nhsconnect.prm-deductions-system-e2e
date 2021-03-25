import { largeHealthRecordExtractTemplate } from './data/large_ehr_extract';
import { config } from '../config';
import { v4 } from 'uuid';
import axios from 'axios';
import adapter from 'axios/lib/adapters/http';
import { connectToQueueAndAssert } from '../utils/queue/handle-queue';

describe('largeDeductionRequest', () => {
  it('should send continue request when large health record extract received', async done => {
    const nhsNumber = `9692842312`;
    const testHarnessOdsCode = 'A91720';
    const CONTINUE_REQUEST_INTERACTION_ID = 'COPC_IN000001UK01';
    const mhsInboundUrl = config.mhsInboundUrl;

    // retrieve patient details from pds
    const pdsDetails = await getAndValidatePatientPdsDetails(nhsNumber);
    console.log(`Retrieved patient details from pds: old ods code: ${pdsDetails.odsCode}`);

    // if patient's ods code isn't test harness, reassign them
    if (pdsDetails.odsCode !== testHarnessOdsCode) {
      await updateAndValidatePatientOdsCode(
        nhsNumber,
        pdsDetails.patientPdsId,
        pdsDetails.serialChangeNumber,
        testHarnessOdsCode,
        pdsDetails.conversationId
      );
      console.log('Updated patients ods code to test harness ods code');
    }

    // trigger deduction in gp to repo from test harness/gp practice
    const conversationId = await makeDeductionRequest(nhsNumber);
    const messageId = v4();
    console.log(`Triggered deduction request, ConversationID: ${conversationId}`);

    // Create large message response
    const largeHealthRecordExtract = generateLargeHealthRecordExtract(
      conversationId,
      nhsNumber,
      testHarnessOdsCode,
      messageId
    );
    console.log('Generated large health record');

    // Add large message to MHS Inbound
    const headers = {
      Soapaction: 'urn:nhs:names:services:gp2gp/RCMR_IN030000UK06',
      'Content-Type':
        'multipart/related;charset="UTF-8";type="text/xml";boundary="2f5a95be-81e0-4f4a-b62f-88c3a02a697c";start="<ContentRoot>"'
    };

    await axios
      .post(mhsInboundUrl, largeHealthRecordExtract, { headers: headers, adapter })
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
  }, 50000);
});

const getAndValidatePatientPdsDetails = async nhsNumber => {
  const { gp2gpAdaptorAuthKeys, nhsEnvironment } = config;
  const gp2gpAdaptorUrl = `https://${nhsEnvironment}.gp2gp-adaptor.patient-deductions.nhs.uk`;

  try {
    const pdsResponse = await axios.get(`${gp2gpAdaptorUrl}/patient-demographics/${nhsNumber}`, {
      headers: {
        Authorization: gp2gpAdaptorAuthKeys
      },
      adapter
    });

    return { ...pdsResponse.data.data, conversationId: pdsResponse.data.conversationId };
  } catch (err) {
    console.log('failed to retrieve patient details from pds', err.response.status);
    return {};
  }
};

const updateAndValidatePatientOdsCode = async (
  nhsNumber,
  pdsId,
  serialChangeNumber,
  newOdsCode,
  conversationId
) => {
  const { gp2gpAdaptorAuthKeys, nhsEnvironment } = config;
  const gp2gpAdaptorUrl = `https://${nhsEnvironment}.gp2gp-adaptor.patient-deductions.nhs.uk`;

  try {
    await axios.patch(
      `${gp2gpAdaptorUrl}/patient-demographics/${nhsNumber}`,
      {
        pdsId,
        serialChangeNumber,
        newOdsCode,
        conversationId
      },
      {
        headers: {
          Authorization: gp2gpAdaptorAuthKeys
        },
        adapter
      }
    );
  } catch (err) {
    console.log('failed to update pds', err.response.status);
    return {};
  }
};

const makeDeductionRequest = async nhsNumber => {
  const { gpToRepoAuthKeys, nhsEnvironment } = config;
  const gpToRepoUrl = `https://${nhsEnvironment}.gp-to-repo.patient-deductions.nhs.uk`;

  try {
    const deductionRequest = await axios.post(
      `${gpToRepoUrl}/deduction-requests`,
      { nhsNumber },
      {
        headers: { Authorization: gpToRepoAuthKeys },
        adapter
      }
    );
    const location = deductionRequest.headers.location;
    return location.split('/deduction-requests/')[1];
  } catch (err) {
    console.log('failed to make deduction request', err.response.status);
    return {};
  }
};

const generateLargeHealthRecordExtract = (conversationId, nhsNumber, odsCode) => {
  return largeHealthRecordExtractTemplate
    .replace('${conversationId}', conversationId)
    .replace('${nhsNumber}', nhsNumber)
    .replace('${odsCode}', odsCode)
    .replace('${messageId}', messageId);
};

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
