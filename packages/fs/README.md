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

**1.0.3**

- Move `encryptFile` and `decryptFile` from ExternalFs to FileCipher

**1.0.2**

- Adds `encryptFile` and `decryptFile` to ExternalFs

## Test coverage

```
  107 passing (39s)

-----------------------|---------|----------|---------|---------|-----------------------------------
File                   | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s                 
-----------------------|---------|----------|---------|---------|-----------------------------------
All files              |   82.26 |    68.89 |   86.66 |   81.93 |                                   
 DataCache.js          |   89.41 |    74.07 |    90.9 |   89.28 | 17-23,122-123,149                 
 ExternalFs.js         |   94.02 |    76.92 |     100 |   93.93 | 9,29,35,54                        
 FileCipher.js         |   88.63 |    73.33 |     100 |   88.63 | 8,52,80,85,94                     
 FsUtils.js            |     100 |      100 |     100 |     100 |                                   
 GitConflictChecker.js |   77.21 |     72.6 |     100 |   77.21 | ...16,126,129,138,155,186,199,218 
 InternalFs.js         |   85.37 |    71.87 |   85.18 |   85.25 | ...30,341,361,420-425,457,465-476 
 Messages.js           |     100 |      100 |     100 |     100 |                                   
 Node.js               |    66.1 |    54.81 |   78.72 |   65.31 | ...05,644-648,666,669,683-720,729 
 Tree.js               |   89.91 |    74.09 |   86.48 |   89.63 | ...39,466,476,530,622,630,661-672 
-----------------------|---------|----------|---------|---------|-----------------------------------
```

## Copyright

(c) 2020-present [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>)

## Licence

MIT
