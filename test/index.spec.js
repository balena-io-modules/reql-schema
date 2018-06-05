/*
 * Copyright 2018 resin.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const ava = require('ava')
const rethinkdb = require('rethinkdb')
const translator = require('..')

// A terrible hack to access the Func AST class
// and be able to control the .nextVarId internal
// counter for testing purposes.
// eslint-disable-next-line no-proto,no-restricted-properties
const Func = require('rethinkdb/ast').expr(Object.is).__proto__

ava.test('wildcard schema', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		additionalProperties: true
	})

	const query = rethinkdb
		.db('myDb')
		.table('myTable')

	test.deepEqual(result.build(), query.build())
})

ava.test('one string property', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			foo: {
				type: 'string'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING'))

	test.deepEqual(result.build(), query.build())
})

ava.test('one string property with const', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			foo: {
				type: 'string',
				const: 'bar'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING')
			.and(rethinkdb.row('foo').eq('bar')))

	test.deepEqual(result.build(), query.build())
})

ava.test('one string property with pattern', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			foo: {
				type: 'string',
				pattern: '^foo$'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING')
			.and(rethinkdb.row('foo').match('^foo$')))

	test.deepEqual(result.build(), query.build())
})

ava.test('one string property with enum', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			foo: {
				type: 'string',
				enum: [ 'foo', 'bar', 'baz' ]
			}
		}
	})

	Func.constructor.nextVarId -= 2

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING')
			.and(rethinkdb.expr([
				'foo',
				'bar',
				'baz' ]
			).contains(rethinkdb.row('foo'))))

	test.deepEqual(result.build(), query.build())
})

ava.test('one array property with contains', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			foo: {
				type: 'array',
				contains: {
					const: 'hello'
				}
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('ARRAY')
			.and(rethinkdb.row('foo').contains('hello')))

	test.deepEqual(result.build(), query.build())
})

ava.test('one nested string property with enum', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			foo: {
				type: 'object',
				properties: {
					bar: {
						type: 'string',
						enum: [ 'foo', 'bar', 'baz' ]
					}
				}
			}
		}
	})

	Func.constructor.nextVarId -= 2

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo')('bar').typeOf().eq('STRING')
			.and(rethinkdb.expr([
				'foo',
				'bar',
				'baz'
			]).contains(rethinkdb.row('foo')('bar'))))

	test.deepEqual(result.build(), query.build())
})

ava.test('two string properties', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			foo: {
				type: 'string'
			},
			bar: {
				type: 'string'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING')
			.and(rethinkdb.row('bar').typeOf().eq('STRING')))

	test.deepEqual(result.build(), query.build())
})

ava.test('nested string property', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			foo: {
				type: 'object',
				properties: {
					bar: {
						type: 'string'
					}
				}
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo')('bar').typeOf().eq('STRING'))

	test.deepEqual(result.build(), query.build())
})

ava.test('nested string property with const', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			foo: {
				type: 'object',
				properties: {
					bar: {
						type: 'string',
						const: 'baz'
					}
				}
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo')('bar').typeOf().eq('STRING')
			.and(rethinkdb.row('foo')('bar').eq('baz')))

	test.deepEqual(result.build(), query.build())
})

ava.test('multiple nested strings with const', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			foo: {
				type: 'object',
				properties: {
					bar: {
						type: 'string',
						const: 'baz'
					},
					baz: {
						type: 'string',
						const: 'qux'
					}
				}
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(
			rethinkdb.row('foo')('bar').typeOf().eq('STRING')
				.and(rethinkdb.row('foo')('bar').eq('baz'))
				.and(rethinkdb.row('foo')('baz').typeOf().eq('STRING')
					.and(rethinkdb.row('foo')('baz').eq('qux'))))

	test.deepEqual(result.build(), query.build())
})