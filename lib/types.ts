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

export interface DeleteResult {
  imageId: string;
  reason:  string;

  snapshots: {
    snapshotId: string;
  }[];
}

export interface ImageDeletionPlan {
  image:  EC2.Image;
  reason: string;
}

export interface InstanceIdImagesMap {
  [instanceId: string]: EC2.Image[];
}
