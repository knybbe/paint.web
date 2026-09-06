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
    appRootName: string;
    /** @deprecated Alias for appRootName */
    appId?: string;
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
interface BaseCreateLocalSyncOptions {
    /** Default merge policy when both sides diverged. */
    conflictPolicy?: ConflictPolicy;
    /**
     * IndexedDB database name. Defaults to `localsync-${appRootName}`.
     * Override when multiple apps share a profile and need isolation.
     */
    dbName?: string;
    /** localStorage / IDB key for stable device id. */
    deviceIdKey?: string;
}
type CreateLocalSyncOptions = BaseCreateLocalSyncOptions & ({
    /** App root folder name directly under mapped root (e.g. 'Paint' or 'Pidro'). */
    appRootName: string;
    /** @deprecated Alias for appRootName. */
    appId?: string;
} | {
    /** @deprecated Use `appRootName` instead. */
    appId: string;
    /** App root folder name directly under mapped root (e.g. 'Paint' or 'Pidro'). */
    appRootName?: string;
});
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

declare const STALE_HANDLE_MESSAGE = "Sync folder not found or moved. Please reconnect or change folder.";
interface LocalSync {
    readonly appRootName: string;
    /** @deprecated Alias for appRootName */
    readonly appId: string;
    readonly deviceId: string;
    isSupported: () => boolean;
    getState: () => LocalSyncState;
    subscribe: (listener: (s: LocalSyncState) => void) => () => void;
    init: () => Promise<LocalSyncState>;
    mapFolder: () => Promise<LocalSyncState>;
    unmapFolder: () => Promise<LocalSyncState>;
    requestPermission: () => Promise<boolean>;
    clearError: () => void;
    put: <T = unknown>(collection: string, id: string, payload: T) => Promise<SyncDocument<T>>;
    get: <T = unknown>(collection: string, id: string) => Promise<SyncDocument<T> | null>;
    list: <T = unknown>(collection: string) => Promise<SyncDocument<T>[]>;
    delete: (collection: string, id: string) => Promise<SyncDocument | null>;
    hardDelete: (collection: string, id: string) => Promise<void>;
    sync: () => Promise<LocalSyncState>;
    onConflict: (handler: ConflictHandler | null) => void;
    listConflicts: () => ConflictInfo[];
    resolveConflict: (collection: string, id: string, choice: ConflictChoice | SyncDocument | unknown) => Promise<SyncDocument>;
}
declare function createLocalSync(options: CreateLocalSyncOptions): LocalSync;

type ExplorerNodeKind = 'folder' | 'file';
interface ExplorerFolderNode {
    kind: 'folder';
    id: string;
    name: string;
    parentId: string | null;
    path: string;
}
interface ExplorerFileNode {
    kind: 'file';
    id: string;
    collection: string;
    name: string;
    parentId: string | null;
    path: string;
    doc: SyncDocument;
}
type ExplorerNode = ExplorerFolderNode | ExplorerFileNode;
interface FolderPayload {
    name: string;
    parentId: string | null;
}
interface PlacementPayload {
    collection: string;
    docId: string;
    parentId: string | null;
    name?: string;
}
interface CreateExplorerOptions {
    collections: string[];
    foldersCollection?: string;
    placementsCollection?: string;
    getDisplayName?: (doc: SyncDocument) => string;
}
interface Explorer {
    listChildren: (parentId?: string | null) => Promise<ExplorerNode[]>;
    getTree: () => Promise<ExplorerNode[]>;
    createFolder: (name: string, parentId?: string | null) => Promise<ExplorerFolderNode>;
    rename: {
        (node: ExplorerFolderNode, newName: string): Promise<ExplorerFolderNode>;
        (node: ExplorerFileNode, newName: string): Promise<ExplorerFileNode>;
        (node: ExplorerNode, newName: string): Promise<ExplorerNode>;
    };
    move: {
        (node: ExplorerFolderNode, newParentId: string | null): Promise<ExplorerFolderNode>;
        (node: ExplorerFileNode, newParentId: string | null): Promise<ExplorerFileNode>;
        (node: ExplorerNode, newParentId: string | null): Promise<ExplorerNode>;
    };
    delete: (node: ExplorerNode, opts?: {
        recursive?: boolean;
    }) => Promise<void>;
    permanentDelete: (node: ExplorerNode, opts?: {
        recursive?: boolean;
    }) => Promise<void>;
    ensurePlacement: (collection: string, docId: string, parentId?: string | null, name?: string) => Promise<SyncDocument<PlacementPayload>>;
    subscribe: (listener: (state: LocalSyncState) => void) => () => void;
}
declare function validateName(name: string): string;
declare function sortExplorerNodes(nodes: ExplorerNode[]): ExplorerNode[];
declare function createExplorer(sync: LocalSync, options: CreateExplorerOptions): Explorer;

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

/** @deprecated LOCALSYNC_DIR nesting has been removed. Layout is now <mapped-root>/<appRootName>/ */
declare const LOCALSYNC_DIR = "localsync";
declare function isFolderSyncSupported(): boolean;
declare function isNotFoundError(error: unknown): boolean;
/**
 * Idempotent directory resolve:
 * - Case-insensitive match on existing entries in parent.
 * - Reuses existing handle if found (never creates multiple folders with same logical name).
 * - Deduplicates concurrent in-flight requests to prevent duplicate creation races.
 */
declare function getDir(parent: FileSystemDirectoryHandle, name: string, create?: boolean): Promise<FileSystemDirectoryHandle>;
/**
 * Opens or creates ONLY the single appRootName child under the mapped root.
 * Layout: <mapped-root>/<appRootName>/...
 */
declare function getAppDir(root: FileSystemDirectoryHandle, appRootName: string, create?: boolean): Promise<FileSystemDirectoryHandle>;

/**
 * Stable per-browser-profile device id (localStorage, falling back to memory).
 */
declare function getOrCreateDeviceId(key?: string): string;

export { type AppMeta, type ConflictChoice, type ConflictHandler, type ConflictInfo, type ConflictPolicy, type CreateExplorerOptions, type CreateLocalSyncOptions, type Explorer, type ExplorerFileNode, type ExplorerFolderNode, type ExplorerNode, type ExplorerNodeKind, type FolderPayload, LOCALSYNC_DIR, type LocalSync, type LocalSyncState, type MergeDocumentsResult, type MergeOutcome, type PlacementPayload, STALE_HANDLE_MESSAGE, type SyncDocument, type SyncStatus, compareUpdatedAt, createExplorer, createLocalSync, effectiveTime, getAppDir, getDir, getOrCreateDeviceId, isFolderSyncSupported, isNotFoundError, mergeDocuments, mergeOne, pickNewer, sortExplorerNodes, validateName };
