# @secrez/test-helpers

Secrez is the secrets manager for the cryptocurrencies era.

This is a utils library for testing.

## History

**2.0.3**

- add `fileCipherLegacy` test helpers (`encryptWithPassword`, `writeV1EncryptedFile`) for v1 `.secrez` export/import tests
- add clipboard image test helpers (`clipboardTest`, `copyImageToClipboard`)
- require Node.js 20 or later (`engines.node >=20.0.0`)
- remove unused `superagent` and dead HTTPS/`sendMessage` helpers left from the old shared-secrets test path
- upgrade mocha to 10.x

**2.0.2**

- add helpers to create, reset, and clone local bare git remotes for tests (`createBareRemote`, `resetBareRemote`, `cloneFromBareRemote`, `configureGitUser`)

**2.0.0**

- Use reduced versions of other Secrez packages to avoid cyclic dependencies. They didn't affect any Secrez package in production because test-helpers is used only for testing purposes, but it is cleaner this way.

## Test coverage

```
  1 passing (3ms)

----------------------|---------|----------|---------|---------|----------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s    
----------------------|---------|----------|---------|---------|----------------------
All files             |    10.8 |        2 |    7.82 |   11.25 |                      
 src                  |    14.4 |        0 |    5.55 |   16.98 |                      
  index.js            |    14.4 |        0 |    5.55 |   16.98 | 19-159,172-221       
 src/lib              |   10.06 |     2.33 |    8.24 |   10.23 |                      
  Crypto0.js          |   63.63 |    28.57 |      50 |   63.63 | 23,27,37-46          
  DataCache0.js       |    8.23 |     1.85 |    9.09 |    8.33 | 10-149               
  Entry0.js           |   48.27 |    26.08 |      50 |   48.27 | 13-19,27,40-45,60-68 
  Messages0.js        |     100 |      100 |     100 |     100 |                      
  Node0.js            |    2.25 |        0 |       0 |     2.3 | 12-730               
  clipboardTest.js    |    6.45 |        0 |       0 |    6.66 | 4-78                 
  coreConfig.js       |     100 |      100 |     100 |     100 |                      
  fileCipherLegacy.js |      50 |      100 |       0 |      50 | 5-7                  
  gitTestRemote.js    |    8.77 |        0 |       0 |    8.77 | 7-129                
  utils0.js           |   27.77 |        0 |   14.28 |   27.77 | 6-20,31-35           
----------------------|---------|----------|---------|---------|----------------------
```

### Notice that most function here are taken from other packages, so they are already tested.

## Copyright

(c) 2020-present [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>)

## Licence

MIT
