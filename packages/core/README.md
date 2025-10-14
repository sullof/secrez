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

**0.8.5**

- improve \_Secrez and Secrez encapsulation of private data
- when changing the password, compares the existent password with the derivated one to avoid brute force attacks from inside Secrez (for example, in a future plugin)

## Test coverage

```
  60 passing (889ms)

-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.75 |    94.31 |     100 |   99.75 |
 src             |     100 |    96.06 |     100 |     100 |
  Entry.js       |     100 |    95.65 |     100 |     100 | 39
  Secrez.js      |     100 |    96.94 |     100 |     100 | 154,319,442
  _Secrez.js     |     100 |    91.66 |     100 |     100 | 14,226
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
