/** Sync status for folder mapping / permission / sync cycle. */
type SyncStatus = 'unsupported' | 'unmapped' | 'mapped' | 'permission_needed' | 'syncing' | 'error';
type ConflictPolicy = 'lww' | 'detect';
/** On-disk / in-IDB document envelope. */
interface SyncDocument<T = unknown> {
    version: 1;
    id: string;
    collection: string;
    updatedAt: string;
    createdAt: string;
    deletedAt?: string | null;
    deviceId: string;
    /** Monotonic revision per device for this doc. */
    rev: number;
    /** Parent `updatedAt` seen when this edit was made (conflict detection). */
    baseUpdatedAt?: string;
    payload: T;
}
interface AppMeta {
    version: 1;
    appId: string;
    updatedAt: string;
}
interface LocalSyncState {
    status: SyncStatus;
    folderName: string | null;
    lastSyncedAt: string | null;
    lastError: string | null;
    supported: boolean;
    pendingConflicts: number;
}
interface ConflictInfo<T = unknown> {
    collection: string;
    id: string;
    local: SyncDocument<T>;
    remote: SyncDocument<T>;
}
type ConflictChoice = 'local' | 'remote';
type ConflictHandler = (conflict: ConflictInfo) => ConflictChoice | SyncDocument | Promise<ConflictChoice | SyncDocument>;
interface CreateLocalSyncOptions {
    /** App namespace under localsync/<appId>/ */
    appId: string;
    /** Default merge policy when both sides diverged. */
    conflictPolicy?: ConflictPolicy;
    /**
     * IndexedDB database name. Defaults to `localsync-<appId>`.
     * Override when multiple apps share a profile and need isolation.
     */
    dbName?: string;
    /** localStorage / IDB key for stable device id. */
    deviceIdKey?: string;
}
type MergeOutcome<T = unknown> = {
    kind: 'keep';
    doc: SyncDocument<T>;
} | {
    kind: 'conflict';
    local: SyncDocument<T>;
    remote: SyncDocument<T>;
};
interface MergeDocumentsResult<T = unknown> {
    /** Winning docs (including tombstones that should stay on disk). */
    docs: SyncDocument<T>[];
    conflicts: ConflictInfo<T>[];
}

interface LocalSync {
    readonly appId: string;
    readonly deviceId: string;
    isSupported: () => boolean;
    getState: () => LocalSyncState;
    subscribe: (listener: (s: LocalSyncState) => void) => () => void;
    init: () => Promise<LocalSyncState>;
    mapFolder: () => Promise<LocalSyncState>;
    unmapFolder: () => Promise<LocalSyncState>;
    requestPermission: () => Promise<boolean>;
    put: <T = unknown>(collection: string, id: string, payload: T) => Promise<SyncDocument<T>>;
    get: <T = unknown>(collection: string, id: string) => Promise<SyncDocument<T> | null>;
    list: <T = unknown>(collection: string) => Promise<SyncDocument<T>[]>;
    delete: (collection: string, id: string) => Promise<SyncDocument | null>;
    sync: () => Promise<LocalSyncState>;
    onConflict: (handler: ConflictHandler | null) => void;
    listConflicts: () => ConflictInfo[];
    resolveConflict: (collection: string, id: string, choice: ConflictChoice | SyncDocument | unknown) => Promise<SyncDocument>;
}
declare function createLocalSync(options: CreateLocalSyncOptions): LocalSync;

/** Positive if a is newer than b. */
declare function compareUpdatedAt(a: string, b: string): number;
/** Effective timestamp for LWW / tombstone ordering. */
declare function effectiveTime(doc: SyncDocument): string;
/**
 * Merge one local + one remote document for the same id.
 *
 * Rules:
 * 1. Missing side → keep the other
 * 2. Same version → keep local
 * 3. One side based on the other (baseUpdatedAt) → take the child
 * 4. Both diverged → lww or conflict
 * 5. Tombstones: newer delete wins; newer live resurrects
 */
declare function mergeOne(local: SyncDocument | null | undefined, remote: SyncDocument | null | undefined, policy: ConflictPolicy): MergeOutcome;
/**
 * Merge two lists of documents (typically same collection). Different ids kept.
 * Tombstones are retained so sync can write them to the folder.
 */
declare function mergeDocuments(localDocs: SyncDocument[], remoteDocs: SyncDocument[], policy: ConflictPolicy): MergeDocumentsResult;
/** Apply LWW between two docs. */
declare function pickNewer(a: SyncDocument, b: SyncDocument): SyncDocument;

declare function isFolderSyncSupported(): boolean;

/**
 * Stable per-browser-profile device id (localStorage, falling back to memory).
 */
declare function getOrCreateDeviceId(key?: string): string;

export { type AppMeta, type ConflictChoice, type ConflictHandler, type ConflictInfo, type ConflictPolicy, type CreateLocalSyncOptions, type LocalSync, type LocalSyncState, type MergeDocumentsResult, type MergeOutcome, type SyncDocument, type SyncStatus, compareUpdatedAt, createLocalSync, effectiveTime, getOrCreateDeviceId, isFolderSyncSupported, mergeDocuments, mergeOne, pickNewer };
