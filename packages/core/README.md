# @secrez/core

Secrez is the secrets manager for the cryptocurrencies era.

@secrez/core is the basic library.

It exposes

- Secrez
- Crypto
- Entry
- config
- ConfigUtils

Those classes are used by other Secrez packages to interact with the encrypted database.

## TODO

API documentation

## History

**1.0.8**

- clear cryptographic secrets from memory on `signout` via `clearSecrets()` (best-effort buffer zeroing)
- guard crypto APIs with `assertLoggedIn()` after signout
- replace deprecated `homedir` package with `os.homedir()`
- require Node.js 20 or later (`engines.node >=20.0.0`)
- fix `decryptEntry` content-only path: set `ts` from `e.t` instead of `e.i` (SIG-4)

**1.0.7**

- remove legacy shared-secret / second-factor authentication API (`sharedSignin`, `generateSharedSecrets`, `recoverSharedSecrets`, `removeSharedSecret`, `getSecondFactorData`, and related config); sign-in now requires only the master key

**0.8.5**

- improve \_Secrez and Secrez encapsulation of private data
- when changing the password, compares the existent password with the derivated one to avoid brute force attacks from inside Secrez (for example, in a future plugin)

## Test coverage

```
  56 passing (806ms)

-----------------|---------|----------|---------|---------|----------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s    
-----------------|---------|----------|---------|---------|----------------------
All files        |   98.04 |    92.48 |   98.57 |   98.04 |                      
 src             |   97.91 |    94.28 |   98.33 |   97.91 |                      
  Entry.js       |     100 |    95.65 |     100 |     100 | 39                   
  Secrez.js      |     100 |    97.72 |     100 |     100 | 222                  
  _Secrez.js     |   94.54 |    82.75 |      96 |   94.54 | 11,14-15,114,249-250 
 src/config      |   98.57 |    84.84 |     100 |   98.57 |                      
  ConfigUtils.js |   98.48 |    84.84 |     100 |   98.48 | 137                  
  booleans.js    |     100 |      100 |     100 |     100 |                      
  index.js       |     100 |      100 |     100 |     100 |                      
-----------------|---------|----------|---------|---------|----------------------
```

## Copyright

(c) 2020-present [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>)

## Licence

MIT
