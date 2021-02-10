import { config } from '../../config';

const getHost = function () {
  return !!config.amqQueueUrl && config.amqQueueUrl.split('//')[1].split(':')[0];
};

export const connectOptions = {
  host: getHost(),
  port: 61614,
  ssl: true,
  connectHeaders: {
    host: '/',
    login: config.queueUsername,
    passcode: config.queuePassword
  }
};

export const subscribeHeaders = {
  destination: 'test-harness-raw-inbound',
  ack: 'auto'
};
