# @secrez/fs

Secrez is the secrets manager for the cryptocurrencies era.

This is the filesystem component.

@secrez/fs exposes:

- InternalFs
- ExternalFs
- FsUtils
- Tree
- Node
- DataCache
- FileCipher (starting from 1.0.3)

## TODO

API documentation

## History

**1.1.0**

- strengthen password-based export encryption in `FileCipher`: new **v2** format (PBKDF2, random salt in file, iterations out of band)
- write vault blobs and cache files with mode `0o600` via `VaultPermissions` (FS-1)
- add `fileCipherLegacy` module and `FileCipherLegacy` export for **v1** password-encrypted files (import compatibility and test fixtures)
- require Node.js 20 or later (`engines.node >=20.0.0`)

**1.0.3**

- Move `encryptFile` and `decryptFile` from ExternalFs to FileCipher

**1.0.2**

- Adds `encryptFile` and `decryptFile` to ExternalFs

## Test coverage

```
  108 passing (5s)

-----------------------|---------|----------|---------|---------|-----------------------------------
File                   | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------------|---------|----------|---------|---------|-----------------------------------
All files              |   81.97 |    67.87 |   86.87 |   81.65 |
 DataCache.js          |   89.53 |    74.07 |    90.9 |   89.41 | 18-24,123-124,150
 ExternalFs.js         |   94.02 |    76.92 |     100 |   93.93 | 9,29,35,54
 FileCipher.js         |   88.05 |     73.8 |     100 |   88.05 | 9,39,76,85,91,95,131,136
 FsUtils.js            |     100 |      100 |     100 |     100 |
 GitConflictChecker.js |   72.81 |     61.9 |      90 |   72.81 | ...95,204,222,254,259,277,289,308
 InternalFs.js         |   85.09 |    71.87 |   85.18 |   84.98 | ...33,344,364,423-428,460,470-487
 Messages.js           |     100 |      100 |     100 |     100 |
 Node.js               |    66.1 |    54.81 |   78.72 |   65.31 | ...05,644-648,666,669,683-720,729
 Tree.js               |   89.91 |    74.09 |   86.48 |   89.63 | ...44,471,481,535,627,635,666-677
 fileCipherLegacy.js   |     100 |      100 |     100 |     100 |
-----------------------|---------|----------|---------|---------|-----------------------------------
```

## Copyright

(c) 2020-present [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>)

## Licence

MIT
