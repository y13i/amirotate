import {EC2} from 'aws-sdk';

export interface AMIRotateEvent {
  tagKey?: string;
}

export interface Option {
  NoReboot:  boolean;
  Retention: Retention;
}

interface Retention {
  Period?: number;
  Count?:  number;
}

export interface CreateResult {
  instanceId: string;
  imageId:    string;
  tags:       EC2.Tag[];
}
