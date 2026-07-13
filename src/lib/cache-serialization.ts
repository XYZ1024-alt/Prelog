const DATE_MARKER = "__prelog_cache_date_v1__";

type CacheObject = { readonly [key: string]: unknown };

export function serializeCacheValue(value: unknown): unknown {
  if (value instanceof Date) {
    return { [DATE_MARKER]: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return value.map(serializeCacheValue);
  }

  if (isCacheObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeCacheValue(item)]),
    );
  }

  return value;
}

export function deserializeCacheValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deserializeCacheValue);
  }

  if (!isCacheObject(value)) {
    return value;
  }

  if (isSerializedDate(value)) {
    const date = new Date(value[DATE_MARKER]);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Cached date is invalid.");
    }

    return date;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, deserializeCacheValue(item)]),
  );
}

function isCacheObject(value: unknown): value is CacheObject {
  return typeof value === "object" && value !== null;
}

function isSerializedDate(value: CacheObject): value is { readonly [DATE_MARKER]: string } {
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === DATE_MARKER && typeof value[DATE_MARKER] === "string";
}
