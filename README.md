ReQL Schema
===========

Query RethinkDB with (a subset of) JSON Schema.

Installation
------------

Install `reql-schema` by running:

```sh
npm install --save reql-schema
```

Documentation
-------------

```js
const rethinkdb = require('rethinkdb')
const reqlSchema = require('reql-schema')

const connection = await rethinkdb.connect({ ... })
const cursor = await reqlSchema('myDb', 'myTable', {
	type: 'object',
	required: [ 'foo' ],
	properties: {
		foo: {
			type: 'string'
		}
	}
}).run(connection)

const array = await cursor.toArray()
console.log(array)
```

The following JSON Schema properties have been implemented:

- `type`
- `const`
- `pattern`
- `format` (supports `uuid`, `email`, and `date-time`)
- `minimum`
- `maximum`
- `enum`
- `contains`
- `allOf`
- `anyOf`
- `not`

Tests
-----

Run the following command:

```sh
npm test
```

Contribute
----------

- Issue Tracker: [github.com/resin-io-modules/reql-schema/issues](https://github.com/resin-io-modules/reql-schema/issues)
- Source Code: [github.com/resin-io-modules/reql-schema](https://github.com/resin-io-modules/reql-schema)

Before submitting a PR, please make sure that you include tests, and that the
linter runs without any warning:

```sh
npm run lint
```

Support
-------

If you're having any problem, please [raise an issue][newissue] on GitHub.

License
-------

This project is free software, and may be redistributed under the terms
specified in the [license].

[newissue]: https://github.com/resin-io-modules/reql-schema/issues/new
[license]: https://github.com/resin-io-modules/reql-schema/blob/master/LICENSE
