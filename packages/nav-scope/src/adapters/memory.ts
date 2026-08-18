import type {
  EntryKey,
  NavigationAdapter,
  NavigationEntry,
  NavigationOperation,
  NavScopeEntryMetadata,
} from "../core/types";

interface MemoryEntry {
  readonly key: EntryKey;
  readonly url: string;
  readonly navScope?: NavScopeEntryMetadata;
}

export function createMemoryNavigation(
  initialUrl = "/",
): NavigationAdapter<string> {
  return new MemoryNavigationAdapter(initialUrl);
}

class MemoryNavigationAdapter implements NavigationAdapter<string> {
  #entries: MemoryEntry[];

  #currentIndex = 0;

  #entrySequence = 0;

  readonly #listeners = new Set<() => void>();

  constructor(initialUrl: string) {
    this.#entries = [
      {
        key: this.#createEntryKey(),
        url: initialUrl,
      },
    ];
  }

  current(): NavigationEntry {
    return this.#toPublicEntry(this.#currentIndex);
  }

  entries(): readonly NavigationEntry[] {
    return this.#entries.map((_, index) => this.#toPublicEntry(index));
  }

  push(target: string, metadata: NavScopeEntryMetadata): NavigationOperation {
    this.#entries = this.#entries.slice(0, this.#currentIndex + 1);

    this.#entries.push({
      key: this.#createEntryKey(),
      url: target,
      navScope: cloneMetadata(metadata),
    });

    this.#currentIndex = this.#entries.length - 1;

    this.#emit();

    return completedOperation();
  }

  replace(
    target: string,
    metadata: NavScopeEntryMetadata,
  ): NavigationOperation {
    const current = this.#entries[this.#currentIndex];

    if (!current) {
      throw new Error("Current navigation entry does not exist.");
    }

    this.#entries[this.#currentIndex] = {
      key: current.key,
      url: target,
      navScope: cloneMetadata(metadata),
    };

    this.#emit();

    return completedOperation();
  }

  traverseTo(key: EntryKey): NavigationOperation {
    const index = this.#entries.findIndex((entry) => entry.key === key);

    if (index === -1) {
      throw new Error(`Navigation entry not found: ${key}`);
    }

    this.#currentIndex = index;

    this.#emit();

    return completedOperation();
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  #toPublicEntry(index: number): NavigationEntry {
    const entry = this.#entries[index];

    if (!entry) {
      throw new Error(`Navigation entry does not exist at index ${index}.`);
    }

    return {
      key: entry.key,
      url: entry.url,
      index,

      ...(entry.navScope
        ? {
            navScope: cloneMetadata(entry.navScope),
          }
        : {}),
    };
  }

  #createEntryKey(): EntryKey {
    this.#entrySequence += 1;

    return `entry-${this.#entrySequence}`;
  }

  #emit(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

function completedOperation(): NavigationOperation {
  const completed = Promise.resolve();

  return {
    committed: completed,
    finished: completed,
  };
}

function cloneMetadata(metadata: NavScopeEntryMetadata): NavScopeEntryMetadata {
  return {
    version: metadata.version,

    scopes: metadata.scopes.map((scope) => ({ ...scope })),
  };
}
