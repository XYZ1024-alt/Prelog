import { unstable_cache } from "next/cache";

import { deserializeCacheValue, serializeCacheValue } from "@/lib/cache-serialization";
import {
  PUBLIC_CONTENT_CACHE_TAG,
  PUBLIC_CONTENT_REVALIDATE_SECONDS,
} from "@/lib/cache-tags";

type AsyncQuery<Arguments extends unknown[], Result> = (...args: Arguments) => Promise<Result>;

export function createPublicCachedQuery<Arguments extends unknown[], Result>(
  query: AsyncQuery<Arguments, Result>,
  keyParts: readonly string[],
  tags: readonly string[] = [],
): AsyncQuery<Arguments, Result> {
  const cachedQuery = unstable_cache(
    async (...args: Arguments) => serializeCacheValue(await query(...args)),
    Array.from(keyParts),
    {
      revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
      tags: Array.from(new Set([PUBLIC_CONTENT_CACHE_TAG, ...tags])),
    },
  );

  return async (...args: Arguments) => {
    if (
      process.env.NODE_ENV === "test"
      || process.env.PRELOG_DISABLE_PUBLIC_CACHE === "true"
    ) {
      return query(...args);
    }

    return deserializeCacheValue(await cachedQuery(...args)) as Result;
  };
}
