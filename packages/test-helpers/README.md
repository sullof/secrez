# @secrez/test-helpers

Secrez is the secrets manager for the cryptocurrencies era.

This is a utils library for testing.

## History

**2.0.2**

- add helpers to create, reset, and clone local bare git remotes for tests (`createBareRemote`, `resetBareRemote`, `cloneFromBareRemote`, `configureGitUser`)

**2.0.0**

- Use reduced versions of other Secrez packages to avoid cyclic dependencies. They didn't affect any Secrez package in production because test-helpers is used only for testing purposes, but it is cleaner this way.

## Test coverage

```
  1 passing (3ms)

-------------------|---------|----------|---------|---------|----------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s    
-------------------|---------|----------|---------|---------|----------------------
All files          |   10.48 |      2.1 |    7.89 |   10.91 |                      
 src               |   12.85 |        0 |       4 |   14.87 |                      
  index.js         |   12.85 |        0 |       4 |   14.87 | 19-210,223-272       
 src/lib           |    9.91 |     2.47 |    8.98 |   10.07 |                      
  Crypto0.js       |   63.63 |    28.57 |      50 |   63.63 | 23,27,37-46          
  DataCache0.js    |    8.23 |     1.85 |    9.09 |    8.33 | 10-149               
  Entry0.js        |   48.27 |    26.08 |      50 |   48.27 | 13-19,27,40-45,60-68 
  Messages0.js     |     100 |      100 |     100 |     100 |                      
  Node0.js         |    2.25 |        0 |       0 |     2.3 | 12-730               
  coreConfig.js    |     100 |      100 |     100 |     100 |                      
  gitTestRemote.js |    8.77 |        0 |       0 |    8.77 | 7-129                
  utils0.js        |      25 |        0 |    12.5 |      25 | 7-21,32-49           
-------------------|---------|----------|---------|---------|----------------------
```

### Notice that most function here are taken from other packages, so they are already tested.

## Copyright

(c) 2020-present [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>)

## Licence

MIT
