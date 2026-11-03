import { Types } from 'mongoose';

function isObjectIdLike(value: object): boolean {
  const record = value as Record<string, unknown>;
  return (
    record._bsontype === 'ObjectID' ||
    record.constructor?.name === 'ObjectId' ||
    typeof (record as { toHexString?: unknown }).toHexString === 'function'
  );
}

/** Safe id string from ObjectId, populated doc (`id` / `_id`), or raw string. */
export function resolveRefId(ref: unknown): string | null {
  if (ref === null || ref === undefined) {
    return null;
  }
  if (typeof ref === 'string') {
    return ref;
  }
  if (ref instanceof Types.ObjectId) {
    return ref.toHexString();
  }
  if (typeof ref === 'object') {
    const obj = ref as Record<string, unknown>;
    if (isObjectIdLike(obj)) {
      return new Types.ObjectId(obj as unknown as Types.ObjectId).toHexString();
    }
    if (typeof obj.id === 'string') {
      return obj.id;
    }
    if (obj._id !== undefined && obj._id !== null) {
      return resolveRefId(obj._id);
    }
  }
  return null;
}

export function requireRefId(ref: unknown, label = 'reference'): string {
  const id = resolveRefId(ref);
  if (!id) {
    throw new TypeError(`Invalid ${label} id`);
  }
  return id;
}

/** Stringify ObjectId or BSON ObjectId-shaped values (not arbitrary objects). */
export function objectIdToString(value: unknown): string {
  if (value instanceof Types.ObjectId) {
    return value.toHexString();
  }
  if (typeof value === 'object' && value !== null && isObjectIdLike(value)) {
    return new Types.ObjectId(value as unknown as Types.ObjectId).toHexString();
  }
  if (typeof value === 'string') {
    return value;
  }
  throw new TypeError('Expected ObjectId');
}
