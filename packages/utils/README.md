# @secrez/utils

Secrez is the secrets manager for the cryptocurrencies era.

This is a utils library used by other packages in the @secrez suite.

## History

**1.0.7**

- implement `secureCompare` with `crypto.timingSafeEqual` for constant-time comparison (PWD-3)

**1.0.6**

- require Node.js 20 or later (`engines.node >=20.0.0`)

**1.0.1**

- adds a workaound to avoid converting ETH addresses to floats

**1.0.0**

- uses @secrez/core 1.0.0

## Test coverage

```
  38 passing (136ms)

-------------|---------|----------|---------|---------|-------------------
File         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------|---------|----------|---------|---------|-------------------
All files    |   92.63 |    84.44 |   82.05 |   92.43 |                   
 UglyDate.js |     100 |    96.66 |     100 |     100 | 60                
 index.js    |      90 |    78.33 |   80.55 |   89.62 | 126-128,257-280   
-------------|---------|----------|---------|---------|-------------------
```

## Copyright

(c) 2020-present [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>)

## Licence

MIT
