import stompit from 'stompit';
import { connectOptions, subscribeHeaders } from './config';

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
