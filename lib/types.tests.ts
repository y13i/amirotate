import {Option} from './types';

(() => {
  const option1: Option = {
    NoReboot: true,

    Retention: {
      Period: 200000000,
    },
  };

  const option2: Option = {
    NoReboot: true,

    Retention: {
      Count: 3,
    },
  };

  return {option1, option2};
})();
