import * as AMIRotate from '.';

(() => {
  const option1: AMIRotate.Option = {
    NoReboot: true,

    Retention: {
      Period: 200000000,
    },
  };

  const option2: AMIRotate.Option = {
    NoReboot: true,

    Retention: {
      Count: 3,
    },
  };

  return {option1, option2};
})();
