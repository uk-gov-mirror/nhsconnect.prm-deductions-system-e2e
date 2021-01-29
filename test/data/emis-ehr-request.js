const generateEmisEhrRequestTemplate = (conversationId, nhsNumber, odsCode, asid) =>
  `<RCMR_IN010000UK05 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema"
                   type="Message" xmlns="urn:hl7-org:v3">
  <id root="${conversationId}"/>
  <creationTime value="20201218173637"/>
  <versionCode code="V3NPfIT3.1.10"/>
  <interactionId root="2.16.840.1.113883.2.1.3.2.4.12" extension="RCMR_IN010000UK05"/>
  <processingCode code="P"/>
  <processingModeCode code="T"/>
  <acceptAckCode code="NE"/>
  <communicationFunctionRcv type="CommunicationFunction" typeCode="RCV">
    <device type="Device" classCode="DEV" determinerCode="INSTANCE">
      <id root="1.2.826.0.1285.0.2.0.107" extension="${asid}"/>
    </device>
  </communicationFunctionRcv>
  <communicationFunctionSnd type="CommunicationFunction" typeCode="SND">
    <device type="Device" classCode="DEV" determinerCode="INSTANCE">
      <id root="1.2.826.0.1285.0.2.0.107" extension="918999199024"/>
    </device>
  </communicationFunctionSnd>
  <ControlActEvent type="ControlAct" classCode="CACT" moodCode="EVN">
    <author1 type="Participation" typeCode="AUT">
      <AgentSystemSDS type="RoleHeir" classCode="AGNT">
        <agentSystemSDS type="Device" classCode="DEV" determinerCode="INSTANCE">
          <id root="1.2.826.0.1285.0.2.0.107" extension="918999199024"/>
        </agentSystemSDS>
      </AgentSystemSDS>
    </author1>
    <subject type="ActRelationship" typeCode="SUBJ" contextConductionInd="false">
      <EhrRequest type="ActHeir" classCode="EXTRACT" moodCode="RQO">
        <id root="FFFB3C70-0BCC-4D9E-A441-7E9C41A897AA"/>
        <recordTarget type="Participation" typeCode="RCT">
          <patient type="Patient" classCode="PAT">
            <id root="2.16.840.1.113883.2.1.4.1" extension="${nhsNumber}"/>
          </patient>
        </recordTarget>
        <author type="Participation" typeCode="AUT">
          <AgentOrgSDS type="RoleHeir" classCode="AGNT">
            <agentOrganizationSDS type="Organization" classCode="ORG" determinerCode="INSTANCE">
              <id root="1.2.826.0.1285.0.1.10" extension="A91521"/>
            </agentOrganizationSDS>
          </AgentOrgSDS>
        </author>
        <destination type="Participation" typeCode="DST">
          <AgentOrgSDS type="RoleHeir" classCode="AGNT">
            <agentOrganizationSDS type="Organization" classCode="ORG" determinerCode="INSTANCE">
              <id root="1.2.826.0.1285.0.1.10" extension="${odsCode}"/>
            </agentOrganizationSDS>
          </AgentOrgSDS>
        </destination>
      </EhrRequest>
    </subject>
  </ControlActEvent>
</RCMR_IN010000UK05>`;

export const stripXMLMessage = xml =>
  xml
    .trim()
    .replace(/\r?\n|\r/g, '')
    .replace(/>\s+</g, '><');

export const generateEmisEhrRequestTemplateOutbound = (conversationId, nhsNumber, odsCode, asid) =>
  stripXMLMessage(generateEmisEhrRequestTemplate(conversationId, nhsNumber, odsCode, asid));

export const generateEmisEhrRequestTemplateInbound = (conversationId, nhsNumber, odsCode, asid) =>
  stripXMLMessage(
    `--0adedbcc-ed0f-415d-8091-4e816bf9d86f\r\nContent-Id: <ContentRoot>\r\nContent-Type: text/xml; charset=UTF-8\r\n\r\n<soap:Envelope xmlns:eb="http://www.oasis-open.org/committees/ebxml-msg/schema/msg-header-2_0.xsd" xmlns:hl7ebxml="urn:hl7-org:transport/ebxml/DSTUv1.0" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header><eb:MessageHeader eb:version="2.0" soap:mustUnderstand="1"><eb:From><eb:PartyId eb:type="urn:nhs:names:partyType:ocs+serviceInstance">5XZ-821385</eb:PartyId></eb:From><eb:To><eb:PartyId eb:type="urn:nhs:names:partyType:ocs+serviceInstance">B86041-822103</eb:PartyId></eb:To><eb:CPAId>1b09c9557a7794ff6fd2</eb:CPAId><eb:ConversationId>${conversationId}</eb:ConversationId><eb:Service>urn:nhs:names:services:gp2gp</eb:Service><eb:Action>RCMR_IN010000UK05</eb:Action><eb:MessageData><eb:MessageId>${conversationId}</eb:MessageId><eb:Timestamp>2020-12-18T17:36:38.827Z</eb:Timestamp><eb:TimeToLive>2020-12-18T23:51:38.827Z</eb:TimeToLive></eb:MessageData><eb:DuplicateElimination /></eb:MessageHeader><eb:AckRequested eb:version="2.0" soap:mustUnderstand="1" soap:actor="urn:oasis:names:tc:ebxml-msg:actor:nextMSH" eb:signed="false" /></soap:Header><soap:Body><eb:Manifest eb:version="2.0" soap:mustUnderstand="1"><eb:Reference xlink:href="cid:Content1@e-mis.com/EMISWeb/GP2GP2.2A" xmlns:xlink="http://www.w3.org/1999/xlink"><eb:Description xml:lang="en">RCMR_IN010000UK05</eb:Description><hl7ebxml:Payload style="HL7" encoding="XML" version="3.0" /></eb:Reference></eb:Manifest></soap:Body></soap:Envelope>\r\n--0adedbcc-ed0f-415d-8091-4e816bf9d86f\r\nContent-Id: <Content1@e-mis.com/EMISWeb/GP2GP2.2A>\r\nContent-Transfer-Encoding: 8bit\r\nContent-Type: application/xml; charset=UTF-8\r\n\r\n${generateEmisEhrRequestTemplate(
      conversationId,
      nhsNumber,
      odsCode,
      asid
    )}\r\n--0adedbcc-ed0f-415d-8091-4e816bf9d86f--`
  );
