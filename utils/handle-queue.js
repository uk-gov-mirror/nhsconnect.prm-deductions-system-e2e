import stompit from 'stompit';
import { config } from '../config';

const getHost = function () {
  return !!config.amqQueueUrl && config.amqQueueUrl.split('//')[1].split(':')[0];
};

const connectOptions = {
  host: getHost(),
  port: 61614,
  ssl: true,
  connectHeaders: {
    host: '/',
    login: config.queueUsername,
    passcode: config.queuePassword
  }
};

const subscribeHeaders = {
  destination: 'test-harness-raw-inbound',
  ack: 'auto'
};

export const connectToQueueAndAssert = assertOnMessageReceived => {
  stompit.connect(connectOptions, function (error, client) {
    if (error) {
      console.log('connect error ' + error.message);
      return;
    }

    client.subscribe(subscribeHeaders, function (error, message) {
      if (error) {
        console.log('subscribe error ' + error.message);
        return;
      }

      message.readString('utf-8', function (error, body) {
        if (error) {
          console.log('read message error ' + error.message);
          return;
        }
        assertOnMessageReceived(body);

        client.disconnect();
      });
    });
  });
};
