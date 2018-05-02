
<!-- TOC -->

- [1. Overview](#1-overview)
- [2. Directory Structure](#2-directory-structure)
- [3. YAML format](#3-yaml-format)
  - [3.1. top level keys](#31-top-level-keys)
  - [3.2. group](#32-group)
    - [3.2.1. before, beforeEach, after, afterEach](#321-before-beforeeach-after-aftereach)
    - [3.2.2. context](#322-context)
  - [3.3. Test](#33-test)

<!-- /TOC -->

# 1. Overview

This is experimental.

meta-test is intended to automatically generate and run test cases. 

At first stage, we only target mocha tests using supertest (api test). If the early test works and benefits, we may add blackbox, graybox, and even whitebox in future.

code generation is initially implemented using template. But we wish in future there could be a domain language for the purpose.

# 2. Directory Structure

we use there subfolders here:

```
app.js
src
meta
generated
```

src includes the source code for meta-test. meta is used for template files, and generated is the generated sources.

app.js is the entry point for running the test.

A sub-directory in meta folder is either a directory containing only sub-directories, or a directory containing meta test files. A meta test file is named as `tests.yaml`.

# 3. YAML format

YAML format is used for describe a group or groups of tests. We intends to write tests in **declarative** domain language, for clarity, simplicity, and efficiency.

`tests.yaml` is parsed using `js-yaml` package.

## 3.1. top level keys

**users**

such as alice, bob, charlie, etc. 

**groups**

test groups

## 3.2. group

```json
{
  "name": "the fixed name of test group",
  "description": "something"
}
```

a group contains a group of tests. Each group will generate a separate `describe` function code, such as:

```js
describe("group description", done => {
  // ...
})
```

nested group is not supported now.

### 3.2.1. before, beforeEach, after, afterEach

As in mocha, these functions are supported. They are used to generate corresponding functions.

### 3.2.2. context

context包含user

## 3.3. Test

test includes an array of actions. The last one is allowed to assert error. Others can only assert success.

```json
{
  "actions": [
    {
      "name": "such as writedir",
      "args": "参数"
    }
  ]
}
```

一个action包括：

- 行为，即api名称
- 参数
- meta库应该理解返回数据的格式，对应api






