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

**1.0.7**

- remove legacy shared-secret / second-factor authentication API (`sharedSignin`, `generateSharedSecrets`, `recoverSharedSecrets`, `removeSharedSecret`, `getSecondFactorData`, and related config); sign-in now requires only the master key

**0.8.5**

- improve \_Secrez and Secrez encapsulation of private data
- when changing the password, compares the existent password with the derivated one to avoid brute force attacks from inside Secrez (for example, in a future plugin)

## Test coverage

```
  54 passing (929ms)

-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.39 |    93.49 |    98.5 |   99.39 |                   
 src             |   99.61 |    95.58 |   98.24 |   99.61 |                   
  Entry.js       |     100 |    95.65 |     100 |     100 | 39                
  Secrez.js      |     100 |    96.66 |     100 |     100 | 207,330           
  _Secrez.js     |   98.93 |     91.3 |   95.65 |   98.93 | 101               
 src/config      |   98.57 |    84.84 |     100 |   98.57 |                   
  ConfigUtils.js |   98.48 |    84.84 |     100 |   98.48 | 137               
  booleans.js    |     100 |      100 |     100 |     100 |                   
  index.js       |     100 |      100 |     100 |     100 |                   
-----------------|---------|----------|---------|---------|-------------------
```

## Copyright

(c) 2020-present [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>)

## Licence

MIT
