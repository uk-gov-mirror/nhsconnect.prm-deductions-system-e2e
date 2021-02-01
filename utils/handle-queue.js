const stompit = require('stompit');

const connectOptions = {
  host: 'g',
  port: 61614,
  ssl: true,
  connectHeaders: {
    host: '/',
    login: '',
    passcode: '',g
  }
};

function waitAndCheck(checkMessageReceived) {
  stompit.connect(connectOptions, function (error, client) {
    if (error) {
      console.log('connect error ' + error.message);
      return;
    }

    const subscribeHeaders = {
      'destination': 'test-harness-raw-inbound',
      'ack': 'client-individual'
    };

    client.subscribe(subscribeHeaders, function (error, message) {

      if (error) {
        console.log('subscribe error ' + error.message);
        return;
      }

      let callback = function (error, body) {

        if (error) {
          console.log('read message error ' + error.message);
          return;
        }
        console.log('received message: ' + body);
        checkMessageReceived(body)

        client.disconnect();
      };
      message.readString('utf-8', callback);
    });
  });
}

waitAndCheck(body => { body.includes("EhrExtract"); done()});