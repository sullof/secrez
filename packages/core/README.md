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
- vault permissions (FS-1): `VaultPermissions` — files `0o600`, dirs `0o700` on create; `secureVaultIfNeeded()` at login (probe `keys/default.json` or `keys/`)

**1.0.7**

- remove legacy shared-secret / second-factor authentication API (`sharedSignin`, `generateSharedSecrets`, `recoverSharedSecrets`, `removeSharedSecret`, `getSecondFactorData`, and related config); sign-in now requires only the master key

**0.8.5**

- improve \_Secrez and Secrez encapsulation of private data
- when changing the password, compares the existent password with the derivated one to avoid brute force attacks from inside Secrez (for example, in a future plugin)

## Test coverage

```
  63 passing (1s)

----------------------|---------|----------|---------|---------|----------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s    
----------------------|---------|----------|---------|---------|----------------------
All files             |    98.3 |    91.57 |   98.76 |    98.3 |                      
 src                  |   97.92 |    94.28 |   98.33 |   97.92 |                      
  Entry.js            |     100 |    95.65 |     100 |     100 | 39                   
  Secrez.js           |     100 |    97.72 |     100 |     100 | 226                  
  _Secrez.js          |   94.54 |    82.75 |      96 |   94.54 | 11,14-15,114,249-250 
 src/config           |   99.19 |       84 |     100 |   99.19 |                      
  ConfigUtils.js      |   98.57 |    84.84 |     100 |   98.57 | 143                  
  VaultPermissions.js |     100 |    82.35 |     100 |     100 | 53,79,102            
  booleans.js         |     100 |      100 |     100 |     100 |                      
  index.js            |     100 |      100 |     100 |     100 |                      
----------------------|---------|----------|---------|---------|----------------------
```

## Copyright

(c) 2020-present [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>)

## Licence

MIT
