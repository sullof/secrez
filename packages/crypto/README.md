# @secrez/crypto

Secrez is the secrets manager for the cryptocurrencies era.

@secrez/crypto is the basic crypto library. It includes only functions that can be called also in a browser.

In @secrez/core it is integrated with methods who works only server side, in order to be used in Secrez.

## TODO

API documentation

## History

**0.1.5**

- adds `bufferToUnti8Array`

**0.1.4**

- adds more methods to encrypt and decrypt buffers too

**0.1.2**

- moving all methods that don't work in a browser back to @secrez/core

**0.1.0**

- moved from @secrez/core to this separate library

## Test coverage

```
  35 passing (349ms)
  2 pending

----------|---------|----------|---------|---------|--------------------------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|--------------------------------------
All files |     100 |    89.36 |     100 |     100 |
 index.js |     100 |    89.36 |     100 |     100 | 34-45,78,104-115,195-199,224,401-405
----------|---------|----------|---------|---------|--------------------------------------

> @secrez/crypto@1.0.5 posttest /Users/francescosullo/Projects/Secrez/secrez/packages/crypto
> nyc check-coverage --statements 99 --branches 85 --functions 99 --lines 99


```

## Copyright

(c) 2020-present [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>)

## Licence

MIT
