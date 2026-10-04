/** The global asset library (PLAN.md#12.19, ADR-015), shared by the app and the `reelforge` CLI. */
export {
  ASSET_LIBRARY_ENV,
  corruptBackupName,
  LIBRARY_PATHS,
  libraryFilesDir,
  libraryIndexFile,
  readLibrary,
  type LibraryRead,
} from './store.js';
export {
  addToLibrary,
  editLibraryEntry,
  findLibraryEntry,
  libraryKey,
  licenceGroup,
  normaliseTags,
  removeFromLibrary,
  searchLibrary,
  useLibraryEntry,
  type LibraryAddOutcome,
  type LibraryEntryEdit,
  type LibraryQuery,
  type LibraryUseOutcome,
  type LibraryUseRequest,
} from './library.js';
