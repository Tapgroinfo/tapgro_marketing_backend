// src/common/helpers/mongoose-transform.ts

import { objectIdToString } from './resolve-ref-id';

function isMongooseInternalKey(key: string): boolean {
  return (
    key.startsWith('$__') ||
    key.startsWith('__') ||
    key === '$__' ||
    key === '_doc' ||
    key === '$isNew' ||
    key === '$locals' ||
    key === '$op' ||
    key === 'activePaths' ||
    key === 'pathsToScopes' ||
    key === 'scopeOptions'
  );
}

function stripMongooseInternals<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripMongooseInternals(item)) as T;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj._bsontype === 'ObjectID' || obj.constructor?.name === 'ObjectId') {
      return objectIdToString(obj) as T;
    }

    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (isMongooseInternalKey(key)) {
        continue;
      }
      cleaned[key] = stripMongooseInternals(val);
    }

    if (cleaned._id !== undefined) {
      cleaned.id = objectIdToString(cleaned._id);
      delete cleaned._id;
    }
    delete cleaned.__v;
    delete cleaned.updatedAt;

    return cleaned as T;
  }
  return value;
}

function applyRootTransform(ret: any) {
  if (ret._id !== undefined) {
    ret.id = objectIdToString(ret._id);
    delete ret._id;
  }
  delete ret.__v;
  delete ret.updatedAt;
  return stripMongooseInternals(ret);
}

export const mongooseTransform = {
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_: any, ret: any) => applyRootTransform(ret),
  },

  toObject: {
    virtuals: true,
    versionKey: false,
    transform: (_: any, ret: any) => applyRootTransform(ret),
  },
};

/** Serialize a mongoose document or subdocument for API responses. */
export function serializeMongooseDoc<T extends { toObject?: () => unknown }>(
  doc: T,
): Record<string, unknown> {
  const plain =
    typeof doc.toObject === 'function'
      ? (doc.toObject() as Record<string, unknown>)
      : stripMongooseInternals(doc as Record<string, unknown>);
  return stripMongooseInternals(plain);
}
