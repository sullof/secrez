# @secrez/test-helpers

Secrez is the secrets manager for the cryptocurrencies era.

This is a utils library for testing.

## History

**2.0.3**

- add `fileCipherLegacy` test helpers (`encryptWithPassword`, `writeV1EncryptedFile`) for v1 `.secrez` export/import tests
- add clipboard image test helpers (`clipboardTest`, `copyImageToClipboard`)
- require Node.js 20 or later (`engines.node >=20.0.0`)

**2.0.2**

- add helpers to create, reset, and clone local bare git remotes for tests (`createBareRemote`, `resetBareRemote`, `cloneFromBareRemote`, `configureGitUser`)

**2.0.0**

- Use reduced versions of other Secrez packages to avoid cyclic dependencies. They didn't affect any Secrez package in production because test-helpers is used only for testing purposes, but it is cleaner this way.

## Test coverage

```
  1 passing (2ms)

----------------------|---------|----------|---------|---------|----------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s    
----------------------|---------|----------|---------|---------|----------------------
All files             |      11 |     2.22 |    7.31 |   11.44 |                      
 src                  |   14.08 |        0 |       4 |   16.26 |                      
  index.js            |   14.08 |        0 |       4 |   16.26 | 21-212,225-274       
 src/lib              |   10.29 |     2.59 |    8.16 |   10.46 |                      
  Crypto0.js          |   68.18 |    42.85 |      50 |   68.18 | 27,37-46             
  DataCache0.js       |    8.23 |     1.85 |    9.09 |    8.33 | 10-149               
  Entry0.js           |   48.27 |    26.08 |      50 |   48.27 | 13-19,27,40-45,60-68 
  Messages0.js        |     100 |      100 |     100 |     100 |                      
  Node0.js            |    2.25 |        0 |       0 |     2.3 | 12-730               
  clipboardTest.js    |    6.45 |        0 |       0 |    6.66 | 4-78                 
  coreConfig.js       |     100 |      100 |     100 |     100 |                      
  fileCipherLegacy.js |      50 |      100 |       0 |      50 | 5-7                  
  gitTestRemote.js    |    8.77 |        0 |       0 |    8.77 | 7-129                
  utils0.js           |      25 |        0 |    12.5 |      25 | 7-21,32-49           
----------------------|---------|----------|---------|---------|----------------------
```

### Notice that most function here are taken from other packages, so they are already tested.

## Copyright

(c) 2020-present [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>)

## Licence

MIT
