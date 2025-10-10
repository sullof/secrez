# Secrez

<h1 align="center">
  <img align="center" src="https://raw.githubusercontent.com/secrez/secrez/master/assets/secrez_2.png" width="300"/>
</h1>

<p align="center">
  <a href="https://github.com/secrez/secrez/issues">
    <img src="https://img.shields.io/github/issues/secrez/secrez.svg">
  </a>

  <a href="https://github.com/secrez/secrez/pulls">
    <img src="https://img.shields.io/github/issues-pr/secrez/secrez.svg">
  </a>

  <a href="https://github.com/secrez/secrez/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/secrez/secrez.svg">
  </a>

  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/secrez/secrez.svg">
  </a>

  <a href="https://discord.gg/whsgXj">
    <img src="https://img.shields.io/badge/chat-on%20discord-brightgreen.svg">
  </a>

  <a href="https://gitter.im/secrez/secrez?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge" alt="Join the chat at https://gitter.im/secrez/secrez">
    <img src="https://badges.gitter.im/secrez/secrez.svg">
  </a>

</p>

Secrez is a CLI secret manager that functions as an encrypted file system, as well as a decentralized, surveillance-resistant, end-to-end encrypted messaging system.

## Intro

At its core, Secrez is a command-line interface that manages an encrypted file system, with commands that work similarly to Unix commands like `cd`, `mkdir`, `ls`, `mv`, etc. The idea is to interact with encrypted virtual files as if they are just files in a standard file system.

## Why Secrez?

Secrez aims to provide a secure password management solution that is available everywhere. While online password managers like LastPass require you to trust a remote server, desktop tools like KeyPass are more secure but difficult to use on multiple computers. To address this, Secrez combines the security of KeyPass with the accessibility of LastPass.

To achieve its goal, Secrez uses several strategies. First, any secret is a local file. Second, any file, whether it's a tree version, a directory, a text file, or a binary file, is immutable. Finally, any change can be pulled/pushed to a remote private repository. You can either create a private repository on GitHub, BitBucket, etc. or set up your own self-hosted Git server.

In addition to functioning as a password manager, Secrez also includes an optional decentralized, surveillance-resistant, end-to-end encrypted messaging system. This provides an extra layer of security for your communications, ensuring that your messages cannot be intercepted or read by anyone other than the intended recipient.

Overall, Secrez offers a powerful and secure solution for managing your passwords and secrets, all from the command line.

## The structure

Secrez simulates an operating system, allowing you to execute commands like ls and mv when you load the environment, similar to what you would normally do in a Unix terminal.

Starting from version 0.6.0, Secrez organizes data into datasets, which act like separate disks, such as /dev/disk1 and /dev/disk2. By default, Secrez generates two datasets: main and trash. You can create more using the use -c command, such as use -c archive.
One of the primary goals of a secrets manager is to ensure that no data is ever lost. However, in some cases, secrets may exist in a folder but not be loaded if only the most recent index is read.

Here's an example: Alice uses Secrez on both computer A and B, and the two data sets are aligned. Suddenly, GitHub goes down, and she makes some changes on both computers. When GitHub comes back online, she pushes the master branch on computer A, and everything goes fine. However, when she pulls on computer B and pushes, the data online become inconsistent because the most recent tree (from B) does not contain the new changes that were previously saved on A. This means that some secrets are in one index, while others are in the other.

No problem. When Alice restarts Secrez, the system finds the extra secrets, reads their positions from the previous indexes, and puts them back in the tree. Since files are immutable, the recovery strategy is not always obvious. Here's what happens in different cases:

If the recovered secret is in a folder that does not exist in the "official" index, the entire path is added using the encrypted data of the recovered secret.
If the secret is a file in a folder that already exists, the file is added as is, but the folders with existing paths are trashed.
If the secret is a file and a file with the same name already exists in the same position, the system checks the content of the file. If it is the same, the secret is ignored. If it's different, it is added as a version.
Any unused or rewritten secrets (as versions) are trashed (you can check them in the trash dataset). In any case, all the contents are kept.

To avoid repeating the same process on the other computer (which will generate files with different IDs and more deleted items), Alice should align the repo on computer A before doing anything there. But if she doesn't, nothing will be lost anyway.

Thus said, **it is a good practice to align the repo before doing anything. You never know.**

## The name convention

In Secrez, file names follow a specific convention:

```
1VAnGLojzCDWhfZRK8PCYK203WBzJkAA28FhKHdS7DM5SkJaTgYdGfN1MAjTdfUYSzvtDVsMJvGodoHWzMuK6zr
```

The first character, 1, indicates the type of file. The remaining characters represent an encrypted message with a nonce, in Base58 format. The encrypted part consists of an ID, timestamp, and the actual filename.

During initialization, Secrez reads all file names and builds a tree of the entire file system. This is done using special files called trees. Once all data has been read, Secrez can determine the tree and add any missing secrets. Since everything is encrypted, it is not possible to deduce information from the files on disk, except for versioning and timestamps, which can be obtained from the Git repo.

To mitigate this risk, you can create a new Git repo, save everything as the first commit, and delete the previously used repo. This will result in losing the repo's history, but it will also prevent someone from accessing information about timestamps and versions.

## The tree

Secrez manages trees as single immutable files. During a session, temporary files are deleted to keep their number low, but at the exit, the last file remains in the repo.

## The cryptographic foundation

Secrez uses [NaCl](https://github.com/dchest/tweetnacl-js) as its primary cryptographic library. NaCl is a widely respected library that provides many algorithms for both synchronous and asynchronous encryption, and its design has been rigorously reviewed by experts in the field. By using NaCl, Secrez is able to provide strong security guarantees for its users.

## How to install it

Secrez requires at least Node 10. If you have installed a previous version, it may generate unclear errors and refuse to install or work properly. We recommend installing Node using nvm if possible. For more information, refer to [https://github.com/nvm-sh/nvm](https://github.com/nvm-sh/nvm).

Since this monorepo uses [Pnpm](https://pnpm.io/), it is better to install secrez using pnpm because the lock file will be used to avoid unexpected conflicts among modules. To install pnpm, run:

```
npm i -g pnpm
```

and then run:

```
pnpm i -g secrez
```

## How to use it

To get started with Secrez, simply run the command:

```
secrez
```

Upon first launch, Secrez will prompt you to enter a master password and the number of iterations. The number of iterations is used to derive a master key from your password, so the higher the number, the more secure your data will be. It's recommended to use between 500,000 and 1,000,000 iterations, but you can customize this based on your needs. For example, you can set the number of iterations explicitly by running:

```
secrez -i 1023896
```

You can also save the number of iterations locally by adding the -s option:

```
secrez -s
```

This will save the number of iterations in a git-ignored env.json file, so you don't have to enter it every time you launch Secrez. If you mistype the number of iterations, Secrez will produce an error.

In addition to the master password and number of iterations, you can also specify other options at launch, such as the initial "external" folder on your computer (-l option) and the container (i.e., the folder) where the encrypted data is located (-c option). By default, both folders are set to your home directory (~). For example, if you want to set up a separate encrypted database in a different folder, you can run:

```
secrez -c ~/data/secrez
```

If the number of iterations you chose makes the initial decryption too slow, you can change it inside the Secrez CLI with the conf command.

## The commands

Launching `help` you can list all available commands.

```
Available commands:
  alias     Create aliases of other commands.
  bash      << deprecated - use "shell" instead
  cat       Shows the content of a file.
  cd        Changes the working directory.
  conf      Shows current configuration and allow to change password and number of iterations).
  contacts  Manages your contacts
  copy      Copy a text file to the clipboard.
  ds        Manages datasets
  edit      Edits a file containing a secret.
  export    Export encrypted data to the OS in the current local folder
  find      Find a secret.
  git       Checks if there is a repo and if there are conflict risks.
  help      This help.
  import    Import files from the OS into the current folder
  lcat      Similar to a standard cat in the external fs.
  lcd       Changes the external working directory.
  lls       Browses the external directories.
  lpwd      Shows the path of the external working directory.
  ls        Browses the directories.
  mkdir     Creates a directory.
  mv        Moves and renames files or folders.
  paste     Paste whatever is in the clipboard in an encrypted entries.
  pwd       Shows the path of the working directory.
  quit      Quits Secrez.
  rm        Removes one or more files and folders.
  shell     Execute a shell command in the current disk folder.
  show      Show a card field as a QR code.
  ssh       Opens a new tab and run ssh to connect to a remote server via SSH
  tag       Tags a file and shows existent tags.
  totp      Generate a TOTP code if a totp field exists in the card.
  touch     Creates a file.
  use       Uses a specific dataset.
  ver       Shows the version of Secrez.
  whoami    Show your Secrez public key
```

## Some example

To display the content of an encrypted file called myPrivateKey, run the following command:

```
cat myPrivateKey
```

By default, the latest version of the file will be displayed. However, you can use additional options to view a specific version or list all versions.

Secrez uses versioning to ensure data integrity and avoid conflicts when backing up and distributing data through Git. Each time a file is modified, a new encrypted file is created with metadata about its ID and timestamp. The timestamp is used to assign a version to the file, which is a 4-letter hash of the timestamp.

Another useful command is the import command. For example:

```
import ~/Desktop/myWallet.json -m
```

This command will encrypt the file myWallet.json located on your Desktop, save it in the encrypted file system, and then delete the original file using the -m option.

This is particularly useful if you have just downloaded a private key to access your crypto wallet and want to encrypt it as soon as possible. With Secrez, you can import the file and delete the cleartext version in one command.

## Aliases — where the fun begins :-)

Suppose you have a bank card and want to log in to your online account. You could copy the email and password to the clipboard to paste them in the browser. If you expect to be able to move from the terminal to the browser in 4 seconds, you could run the command:

```
copy bank.yml -f email password -d 4 2
```

This will copy the email field and give you 4 seconds to paste it in the browser. Then, it will emit a beep, and you have 2 seconds to paste the password. It sounds quite useful, but it can be even better.

If you use that login often, you could create an alias for it with:

```
alias b -c "copy bank.yml -f email password -d 4 2"
```

Next time, you can just type:

```
b
```

It looks great, right? Well, it can be even better.

Let’s say you're using a 2FA app like Google Authenticator to connect to a website, for example, GitHub. Suppose you have a file called github.yml with a field called totp, which is the secret that GitHub gave you when you activated 2FA. You could execute:

```
totp github.yml
```

to generate a TOTP token for GitHub. The token will be shown and copied to the clipboard. Now, you can create an alias like this:

```
alias G -c "copy github.yml -f username password -d 4 2 --wait && totp github.yml"
```

Can you guess what this will do?

It copies the username to the clipboard;
It waits 5 seconds, emits a beep, and copies the password;
It waits 3 seconds, emits a beep, and copies the TOTP token, keeping it in the clipboard.
You can also use parameters in aliases and create a macro like this:

```
alias M -c "copy $1 -f username password -d 4 2 --wait && totp $1"
```

and call it with:

```
M github.yml
```

It's fantastic, isn't it?

_Btw, using a TOTP factor in Secrez is a bit of a contradiction because you are converting a second factor (something that you have) into a first factor (something that you know). So, use this feature only when it makes sense._

## Importing from other password/secret managers

Secrez supports importing backups from other software. Suppose you have exported your passwords in a CSV file named export.csv like this:

```
Path,Username,Password,Web Site,Notes
twitter/nick1,nick1@example.com,938eyehddu373,"http://cssasasa.com"
facebook/account,fb@example.com,926734YYY,,personal
somePath,,s83832jedjdj,"http://262626626.com","Multi
line
notes"
```

A field named path is necessary because Secrez needs to know where to place the new data. The path should be relative, allowing you to import it into your favorite folder.

To import the CSV file into the 1PasswordData folder, for example, you can run:

```
import export.csv -e 1PasswordData -t
```

The parameter -e or --expand is necessary. If it's not provided, Secrez will import the file as a single file.

Internally, Secrez converts the CSV file to a JSON file like this:

```
 [
    {
      path: 'twitter/nick1',
      username: 'nick1@example.com',
      password: '938eyehddu373',
      web_site: 'http://cssasasa.com'
    },
    {
      path: 'facebook/account',
      username: 'fb@example.com',
      password: '926734YYY'
    },
    {
      path: 'somePath',
      password: 's83832jedjdj',
      web_site: 'http://262626626.com',
      notes: 'Multi\nline\nnotes'
    }
  ]
```

This means that you can also format your data as a JSON and import it directly using:

```
import export.json -e 1PasswordData
```

Each item in the JSON will generate a single YAML file. For example, the last element in the JSON will generate the file /1PasswordDate/somePath.yml with the following content:

```
password: s83832jedjdj
web_site: http://262626626.com
notes: |-
  Multi
  line
  notes
```

When you edit the new file, Secrez recognizes it as a card and asks you which field you want to edit (unless you explicitly specify it with, for example, -f password) and edits just that field.

At the end of the process, you can remove the original backup using the -m option. You can also simulate the process to see which files will be created using the -s option.

If the CSV file also contains a tags field, you can automatically tag any entries using the -t or --tags option. If you don't use this option, the tags will be saved in the YAML file like any other field.

### What if there is no path field?

Let's say you want to import a CSV file exported by LastPass, which doesn't have a path field. In this case, you can use other fields, such as grouping and name, to build the path instead. Starting from version 0.8.8, you can do this by running:

```
import ~/Downloads/lastpass_export.csv -e lastpass -P grouping name
```

Or, if you want to put everything in the folder `lastpass` without generating any subfolders, you can run:

```
import ~/Downloads/lastpass_export.csv -e lastpass -P name -m
```

By using only the name field, any entries with a slash in the name will create a subfolder. The -m option will remove the CSV file from the operating system after importing.

In both examples, make sure that all entries in the LastPass CSV file have a name. If not, the import will fail because Secrez won't know how to name the file.

### Best practices

For security reasons, it is better to export from your password manager and import into Secrez as quickly as possible, removing the exported file from your OS using -m.

However, if you need to edit the exported file to fix paths and names, it is more convenient to do it before importing the data, as it can take a lot more time to do so after the data is imported.

## FIDO2 second factor authentication?

It has been removed in version 0.11.0 due to potential critical issues with Python and the required libraries on MacOS (2FA may be restored if a pure Javascript library becomes available).

## (experimental) End-to-end encrypted communication with other accounts

Starting from version 0.8.0, Secrez allowed you to exchange encrypted messages with other users. To do so, it was using the packages `@secrez/courier`, `@secrez/hub`, `@secrez/tls` and `@secrez/tunnel`. Those four packages have been removed in version 2.0.0 since the feature was hard to maintain and not very used.

## Blog posts

[Secrez — a secrets manager in time of cryptocurrencies](https://sullof.medium.com/secrez-a-secrets-manager-in-time-of-cryptocurrencies-b15120c5aa14) - an intro to Secrez

[Send encrypted messages via Secrez](https://sullof.medium.com/send-encrypted-messages-via-secrez-a8321b561af3) - an intro to the experimental messaging

## Some thoughts

Secrez is not intended to compete with password managers, so do not expect it to have features like "form filling." The idea behind Secrez originated in 2017 when I was participating in many ICOs, and I had so many files to save, but any password manager I used was not very effective. Secrez is file-oriented and will likely remain so. However, it is open source, and someone is welcome to build a GUI or mobile app built on it.

## History

**2.1.11**

- fix warning "(node:70960) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities" caused by the Git checker

**2.1.10**

- add external git change detection to block operations when repository state changes outside of Secrez (e.g., `git pull` in another terminal)
- fix critical cache bug in git conflict detection that prevented external changes from being detected within 30 seconds
- improve git conflict detection tests with comprehensive coverage for both git and non-git repositories

**2.1.9**

- add `<` parameter to reuse the last used path in commands (e.g., `totp <` will use the last path from previous command)
- fix deprecation warning in `execSync` by properly escaping command arguments

**2.1.8**

- add `git` command to check repository status and detect remote changes
- add git conflict detection middleware to prevent conflicts during data-changing operations

**2.1.7**

- add option `--no-export` to `export --crypto-env` to display the encrypted content in the console instead of writing it to a file

**2.1.6**

- export and encrypt, with option `--crypto-env`, the entire content of an item

**2.1.5**

- duplicate files using `touch <newfile> --from <file>` to copy the file from the source to the destination

**2.1.4**

- uses clipboard only on macOS
- fixes `copy` return message when clipboard is not available

**2.1.2**

- disable `copy` command when in headless shells

**2.1.1**

- manage missing clipboard when in headless shells
- fix bug in creating a `totp` when the target Yaml file is empty

**2.0.1**

- fix commands to change password and number of iterations

**2.0.0** (breaking changes)

- remove `@crypto/hub`, `@crypto/courier`, `@crypto/tunnel` and `@crypto/tls` since they are not maintained anymore
- add `show` command to show a card field as a QR code, for example to encode a private key and let a mobile wallet scan it

**1.1.6**

- add support for cryptoEnv format to `export` (look at https://github.com/secrez/cryptoenv for details about CryptoEnv)

**1.1.5**

- fix touch's help showing wrong, temporary options, changed during the development :-(

**1.1.4**

- add clear screen after 180 seconds to avoid that the user forgot its terminal open and accidentally shares it while sharing the screen during meetings — it happened to me :-(
- add option `--timeout, -t` to customize the timeout when launching secrez

**1.1.3**

- add new option `--keystore, -k` to `export`. If a file contains a private key field (i.e., a field with a name containing `private_key`), it can be exported in the keystore format. The file will have the same name with the extension replaced with `.keystore.json`.
- this README has been redacted by ChatGPT to make it more clear and concise.

**1.1.2**

- New options for `touch`:
  - `--wait-for-content` to prompt the user to add the content, instead of expecting it as a parameter. The content will be trimmed at the first newline, if there is any.
  - `--generate-wallet` to generate an Ethereum-compatible wallet in a new card or in an existing one. It generates the fields `private_key` and `address`, with private key and address.
  - `--prefix` in combination with `--generate-wallet` specifies the prefix of the field, calling the fields, for example `my_private_key` and `my_address` if the prefix is `my`.
  - `--amount` in combination with `--generate-wallet` specifies the amount of wallets to generate. The default is 1.

**1.1.1** (unpublished)

- using prettier for consistent formatting

**1.1.0**

- Remove `git`. If used carefully, the command was helpful, but still it is at risk of creating conflicts. After long thoughts, I disapproved my own proposal at: https://github.com/secrez/secrez/pull/163

**1.0.4**

- Fix wrong example in `import`

**1.0.3**

- `git` asks to quit Secrez and merge manually if there are remote changes
- `totp` allows to add a totp code to an existing yaml file using the option `--set` (see the examples)
- Default duration before clipboard reverse for `totp` is now 8 seconds

**1.0.2**

- Export and Import can encrypt/decrypt files using shared keys generated from a specified public key
- Can export ecrypted file for the user itself, files that can be decrypted only from inside the secrez account that exported them

**1.0.1**

- Export and Import can handle encryption. Files can be exported encrypted using a specified password or a key shared with contacts
- Contacts can add a contact also using contact's public key (previously you need a hub url)
- Import specifies the file that have been skipped (because binary, encrypted or both)

**1.0.0**

- Requires `@secrez/utils@1.0.1` which fixes a yaml parsing error with ETH-like addresses

**1.0.0-beta.3**

- Rm allows to delete specific versions of a file

**1.0.0-beta.2**

- Git has new options `--init`, `--remote-url` and `--main-branch` to initiate a repo from inside Secrez

**1.0.0-beta.1**

- use @secrez/core@1.0.0, which changes the encoding from base58 to base64, making the encoding much faster
- remove second factor authentication due to potentially critical issues with Python and the required libraries on macOS (2FA will be restored as soon as either a pure Javascript library is available or using external Python libraries is reliable again)
- `Bash` has been renamed `Shell`

**0.10.8**

- expose a prompt mock to allow other software to run commands programmatically
- fix bug in totp when the command is called but no totp is set

**0.10.7**

- fix bug in `git -i` showing less changed that expected

**0.10.6**

- use `£` as an alternative to `#` when getting find results (whoops, I made this for myself, because I use both English and Italian keyboards)
- add `leave` to leave a room

**10.0.5**

- fix bug in `git` wrongly returning `already up to date`
- fix `git`'s help

**0.10.4**

- remove spaces in secret when launching `totp`
- add a `--test` option, to test a secret
- remove deprecated `exit`

**0.10.3**

- since it's not possible to clear the entire terminal, the clear screen process creates a false sense of security and has been removed
- fix bug in `ls -l` when there are empty files
- add message to suggest user to clear or close the terminal after quitting

**0.10.2**

- add a `git` command to push changes to the repo and pull changes
- allow to run `bash` without parameters, asking later for the shell command

**0.10.1**

- encrypts binary files as is, without converting them to `base64` strings, like before

**0.10.0**

- use @secrez/hub 0.2.0 and @secrez/courier 0.2.0 (which are incompatible with the previous versions)
- duplicate `whoami` and `contacts` to make them working inside the `chat` environment

**0.9.4**

- fix bug during import, if a `path` contains `:`; now, they are replaced with `_`

**0.9.3**

- fix bug with `ds -l` not working

**0.9.2**

- fix issue in `ls -l` that was working only in the current dataset
- fix dates in `ls -l` in UTC time, instead than in local time

**0.9.1**

- `ls -l` returns details: size, creation date, last update date, number of versions and name

**0.9.0**

- Add `ds` to manage datasets
- `ds` is also able to delete a dataset (moving its content to the `trash` dataset)
- Remove feature `--rename` from `use`, since now `ds` manages the datasets

**0.8.10**

- If the default editor is not defined (env variable EDITOR) try to use nano or vim

**0.8.9**

- Pause clearScreen during editing

**0.8.8**

- Add the option `pathFrom` in `import` to build the `path` field using other fields

**0.8.7**

- Importing from a CSV file generates `.yaml` file instead of `.yml`

**0.8.6**

- Uses new onBeforeRewrite in [inquirer-command-prompt](https://github.com/sullof/inquirer-command-prompt) to remove the `#\d` when autocompleting the result of a search

**0.8.5**

- Fix issue with find results when they include datasets.
- Improve scripts (getting coverage only for modified packages)
- Add a secrez.png as a generic asset

**0.8.4**

- fix issue if a file starts with #\d, like `#2something`

**0.8.3**

- add autocomplete based on `find` results; for example `cat #2` and press `tab` will complete with the second result in the search

**0.8.2**

- fix bug in `show` which listed all the messages

**0.8.1**

- fix bug in `conf` setting a 2FA
- improve encapsulation of the `_Secrez` class

**0.8.0**

- add `contacts` to manage trusted users, i.e, trusted public keys
- add `whoami` to get info about the account
- add @secrez/courier to allow communication between local accounts
- add @secrez/hub for the remote hub
- add @secrez/tunnel to manage the tunneling for the Courier
- add `chat` to enter the chat environemnt, and send/receive messages and data to any trusted user
- add `chat`'s subcommands `join`, `send` and `show`.
- return `find` results as a numbered list, to be used as variable (like `$1`) in following commands
- deprecate `exit` in favor of `quit` to leave rooms, chat and app
- add `ssh` to connect via ssh to a remote server from inside Secrez, to protect private keys without password

**0.7.14**

- fix chained aliases generating prompt duplications

**0.7.13**

- fix autocomplete when single command

**0.7.12**

- adds support for Linux to `totp --from-clipboard`, using `xclip`

**0.7.11**

- returns an alert if `clipboardy` does not find the required libraries

**0.7.10**

- fixes the autocomplete loading the data only when needed

**0.7.9**

- fix bug in MainPrompt.js which caused an exit if command not found

**0.7.8**

- upgrade `@secrez/core` to `0.7.1` which fixes an error if `env.json` does not exists

**0.7.7**

- aliases now accept params (ex. `alias x -c 'copy $1 && ls $2 $1')

**0.7.6**

- `rm` ask confirmation before delete forever from the `trash` dataset
- `edit` does not crash if no path is passed

**0.7.5**

- `totp` can read an image to scan a qrcode and recover its secret
- on MacOs, `totp` can also read the image from the clipboard to recover its secret; it requires `pngpaste`

**0.7.4**

- fix bug in autocomplete showing the error stack
- add script to upgrade the versions of any changed packages

**0.7.3**

- `find` ignores `trash` during global searches if not using `--trash-too`
- update to `@secrez/fs 0.7.2`, which fixes a bug in the `DataCache` class

**0.7.2**

- `totp` allows to generate TOTP codes (like Google Authenticator)
- add option `--wait` to `copy` to force it to wait the end of the execution
- `alias` handles chains of commands, like `copy coinbase.yml -f email password -d 3 2 --wait && totp coinbase.yml`

**0.7.1**

- Calling a command with unknown options will generate an error
- Fix issue moving duplicates
- Adds to `mv` an explicit destination field

**0.7.0**

- Introduce a more secure derivation process, using the iterations number in the salt. During the upgrade existing second factors of authentication will be removed
- Allow to change password and number of iterations in `conf`. BE CAREFUl, any change in `conf` can cause conflicts in a remote repo. Don't do the same changes parallelly

**0.6.5**

- Add `duration` to `export` to delete the exported file after the duration (in seconds)

**0.6.4**

- Add `alias` to generate alias of any command

**0.6.3**

- Minor bug fix

**0.6.2**

- `copy` can put many fields in the clipboard, scheduling them

**0.6.1**

- Add support for U2F keys (Yubikey, Solokeys, etc.)
- `ls` now returns sorted results
- Fixed bug with `mv` and `rm` when using wildcards
- Dynamic format for help, managing large examples

**0.6.0**

- Allow multiple datasets; `main` and `trash` exists by default
- At start, purges old trees after successfully loading a dataset
- `use` allows to use and create new dataset
- `mv` supports `-d, --destination` for the destination
- `mv` allows to move files among datasets with a syntax like `mv somefile archive:/` or `mv archive:somefile main:/some/`
- `mv` adds `--find` and `--content-too` to use the result of a search as input
- `mv`, if no destination set, asks if like to use the active directory in the target dataset
- `ls -o d` and `ls -o f` to limit the listing only to folders or files
- `copy` allows to select the field to copy in yaml files
- Improve autocomplete to handle datasets
- Fix autocomplete in `lcat`, which was wrongly using the internal files
- `tag` is able to list and show tags along all the datasets, anche can use `--find` like `mv`

**0.5.13**

- Find in content excludes binary contents

**0.5.12**

- Optimize find inside contents caching the data
- Fix an error returning wrong cases in the results
- Remove an unnecessary message when nothing is recovered

**0.5.11**

- Use tags to prefix the path during import

**0.5.10**

- Fix the README that was not aligned

**0.5.9**

- Add Paste to paste the clipboard content in either a new or existent file, emptying the clipboard
- Fix bug with Copy that was preventing the command from working

**0.5.8**

- Allow Import, with the options `-t`, to recognize tags during the import from CSV
- Split Export in Export and Copy. The first only exports to the FS, the second copies to the clipboard

**0.5.7**

- Add wildcard support for Import, Mv, Rm and Tag
- Add support for recursion during import

**0.5.6**

- Add Tag command to tag files and folders

**0.5.5**

- Optimize Import avoiding intermediate saves of the tree
- Fix an issue with iterations at launch

**0.5.4**

- Add Import of many entries from CSV and JSON files

**0.5.3**

- Use Yaml files as cards, being able to read and edit single fields

**0.5.2**

- Remove obfuscation of the tree before saving (it was an overkill)

**0.5.1**

- Add Find to search in files and folders

**0.5.0**

- First stable version

Versions < 0.5.0 are deprecated because the format was sligtly different and they are incompatible.

## Contribute

Firs off, take a look at Secrez's [Code of conduct](https://github.com/secrez/secrez/blob/master/CODE_OF_CONDUCT.md)

Second, join the brand-new [Secrez's Discord group](https://discord.gg/whsgXj)

#### Fork this repo

#### Clone it

In my case, it would be:

```
git clone git@github.com:sullof/secrez.git
```

#### Install the requirements

```
npm i -g pnpm
```

#### Bootstrap the monorepo

```
npm run reset
```

#### Install OS requirements

To complete the tests, you must install some tools depending on your operating system.

The `copy` command does not work on Linux if `xsel` is not installed. So, if you are working on Ubuntu, install it with:

```
sudo apt install xsel
```

The `totp` command requires `pngpaste` on macOS. You can install it with:

```
brew install pngpaste
```

Please note that during the execution of Secrez, an error is generated if those tools have not been found. Please make sure to install them.

#### Testing

To run all the tests, navigate to the root directory of the project and run:

```
npm run test
```

If you are inside a package directory, running this command will only execute the package-specific tests. You can also skip coverage by running:

```
npm run test-only
```

This is useful during development.

#### Debugging

To see if Secrez works properly, you can execute your version of Secrez by running the following command from inside the `packages/secrez` directory:

```
npm run dev
```

You will create a dev account to play with it.

#### Pull Requests

Before submitting a pull request, you should realign the versions. You can do this by running the following command from the root directory:

```
npm run patch-versions
```

Then, you can prepare the README file by inserting the coverage. To do this, run:

```
npm run pre-push
```

Finally, you can push to GitHub.

Thank you for any contributions! 😉

## Test coverage

```
  162 passing (1m)
  1 pending

--------------------|---------|----------|---------|---------|--------------------------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s                    
--------------------|---------|----------|---------|---------|--------------------------------------
All files           |   80.07 |    67.69 |   80.91 |   79.96 |                                      
 src                |   57.62 |    53.75 |      55 |   58.11 |                                      
  Command.js        |   74.66 |    74.13 |   78.57 |   75.67 | ...5-62,73,80,93,127,164-172,179-182 
  PreCommand.js     |    8.82 |        0 |       0 |    8.82 | 6-97                                 
  cliConfig.js      |     100 |      100 |     100 |     100 |                                      
 src/commands       |   83.06 |    69.43 |   90.82 |   82.94 |                                      
  Alias.js          |    88.6 |    78.68 |     100 |   88.46 | 101,112,139,169,173,180,190,213-214  
  Bash.js           |      75 |        0 |   66.66 |      75 | 18-19                                
  Cat.js            |   98.91 |    88.88 |     100 |   98.91 | 152                                  
  Cd.js             |   96.42 |    86.66 |     100 |   96.42 | 44                                   
  Conf.js           |    8.64 |        0 |      20 |    8.64 | 98-509                               
  Contacts.js       |   86.06 |     75.6 |     100 |   85.95 | ...5,165,172,184,237,250,260,268-269 
  Copy.js           |    91.2 |    71.92 |     100 |   91.11 | 115,166,183,205-210,225-226,253      
  Ds.js             |   90.27 |     82.6 |     100 |   90.14 | 99,108-113,125,147-148               
  Edit.js           |   12.94 |        0 |      40 |   12.94 | 88-222                               
  Export.js         |   90.17 |    76.92 |     100 |   90.17 | ...3-198,209,227-231,236,248,257,260 
  Find.js           |   93.58 |    86.66 |     100 |   93.42 | 101,164,200-203,209                  
  Git.js            |   96.15 |       75 |     100 |   96.15 | 61                                   
  Help.js           |     100 |       80 |     100 |     100 | 29                                   
  Import.js         |   92.41 |    85.38 |     100 |   92.34 | ...7,387,393,441,457-458,466-473,500 
  Lcat.js           |     100 |    85.71 |     100 |     100 | 54                                   
  Lcd.js            |   95.65 |    81.81 |     100 |   95.65 | 50                                   
  Lls.js            |   95.45 |    72.72 |     100 |   95.45 | 97                                   
  Lpwd.js           |    92.3 |      100 |     100 |    92.3 | 36                                   
  Ls.js             |   91.54 |    76.31 |     100 |   91.04 | 103,114-116,130,185                  
  Mkdir.js          |   92.59 |       60 |     100 |   92.59 | 56-57                                
  Mv.js             |   86.59 |    71.66 |     100 |   86.31 | 93-99,133,155-156,165,175-182        
  Paste.js          |   84.61 |    70.83 |     100 |   84.61 | 72,78,81,89,113,130-131,139          
  Pwd.js            |    92.3 |      100 |     100 |    92.3 | 33                                   
  Quit.js           |      90 |       50 |     100 |      90 | 27                                   
  Rm.js             |    90.9 |       76 |     100 |   90.74 | 63,125-126,136,144                   
  Shell.js          |   88.23 |       60 |     100 |   88.23 | 38,55                                
  Show.js           |   72.54 |    45.45 |   57.14 |      74 | ...8,100,106-114,117,123-126,132,145 
  Ssh.js            |      25 |        0 |      40 |      25 | 72-120                               
  Tag.js            |   96.26 |    91.37 |     100 |   96.22 | 122,171,204-205                      
  Totp.js           |   92.23 |       75 |     100 |   92.23 | 189-190,230,240,282-287,301-302      
  Touch.js          |   96.36 |    80.64 |     100 |   96.29 | 164,240                              
  Use.js            |   91.66 |    86.95 |     100 |   91.66 | 68,83-84                             
  Ver.js            |      90 |    66.66 |     100 |      90 | 25                                   
  Whoami.js         |   83.33 |       60 |      80 |   83.33 | 27,35,48                             
  index.js          |    87.5 |       50 |     100 |   86.95 | 15,22,31                             
 src/prompts        |      75 |    33.33 |      50 |      75 |                                      
  MainPromptMock.js |      75 |    33.33 |      50 |      75 | 29-35,44                             
 src/utils          |   67.61 |     62.5 |   54.16 |   67.21 |                                      
  AliasManager.js   |     100 |    91.66 |     100 |     100 | 47                                   
  ContactManager.js |   73.33 |       60 |   85.71 |   73.33 | 12,34-36                             
  Fido2Client.js    |    9.61 |        0 |       0 |    9.61 | 8-108                                
  HelpProto.js      |   89.07 |     82.6 |     100 |   88.88 | 49,135-137,153-154,171-176,195       
  Logger.js         |   63.63 |    56.25 |   36.84 |   62.79 | ...25,37-49,57,65-69,74,84,88,93,105 
--------------------|---------|----------|---------|---------|--------------------------------------

> secrez@2.1.11-beta.0 posttest /Users/francescosullo/Projects/Secrez/secrez/packages/secrez
> nyc check-coverage --statements 65 --branches 50 --functions 65 --lines 65


```

## Copyright

Secrez has been created by [Francesco Sullo](https://francesco.sullo.co) (<francesco@sullo.co>). Any opinion, help, suggestion, critic is very welcome.

## Licence

```
MIT License

Copyright (c) 2017-present, Francesco Sullo <francesco@sullo.co>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
