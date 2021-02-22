import stompit from 'stompit';
import { connectOptions, subscribeHeaders } from './config';

const purgeQueue = () => {
  stompit.connect(connectOptions, function (error, client) {
    if (error) {
      console.log('connect error ' + error.message);
      return;
    }

    const createIdleTimer = (timeout, callback) => {
      var pending = 0;
      var timer = null;

      var update = function () {
        if (pending > 0 && timer !== null) {
          clearTimeout(timer);
          timer = null;
        } else if (pending < 1 && timer === null) {
          timer = setTimeout(callback, timeout);
        }
      };

      var increment = function () {
        pending += 1;
        update();
      };

      var decrement = function () {
        pending -= 1;
        update();
      };

      var stop = function () {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      };

      update();

      return {
        increment: increment,
        decrement: decrement,
        stop: stop
      };
    };

    var idleTimeout = createIdleTimer(1000, function () {
      console.log('Client disconnecting');
      client.disconnect();
    });

    client.subscribe(subscribeHeaders, function (error, message) {
      idleTimeout.increment();

      if (error) {
        console.log('subscribe error ' + error.message);
        idleTimeout.stop();
        return;
      }

      message.readString('utf-8', function (error, message) {
        if (error) {
          console.log('read message error ' + error.message);
          idleTimeout.stop();
          return;
        }

        console.log('received message and acknowledged:');
        console.log(message);

        idleTimeout.decrement();
      });
    });
  });
};

purgeQueue();
