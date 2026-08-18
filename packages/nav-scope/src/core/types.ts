export type EntryKey = string;
export type ScopeId = string;

export interface NavigationEntry<TState = unknown> {
  key: EntryKey;
  url: string;
  state: TState;
}

export interface NavigationOperation {
  committed: Promise<void>;
  finished: Promise<void>;
}

export interface NavigationAdapter<TTarget> {
  current(): NavigationEntry;

  entries(): readonly NavigationEntry[];

  push(target: TTarget, state?: unknown): NavigationOperation;

  replace(target: TTarget, state?: unknown): NavigationOperation;

  traverseTo(key: EntryKey): NavigationOperation;

  subscribe(listener: () => void): () => void;
}

export interface ScopeFrame {
  id: ScopeId;
  anchorKey: EntryKey;

  parentScopeId?: ScopeId;

  kind?: string;
  label?: string;
}

export interface NavScopeState {
  version: 1;
  scopes: ScopeFrame[];
}
