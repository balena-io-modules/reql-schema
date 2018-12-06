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
		required: [ 'foo' ],
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
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false))

	test.deepEqual(result.build(), query.build())
})

ava.test('one multiple type property', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: [ 'string', 'number' ]
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.or(rethinkdb.row('foo').typeOf().eq('NUMBER').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one multiple type property with other constraints', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: [ 'string', 'number' ],
				pattern: '^foo$'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.or(rethinkdb.row('foo').typeOf().eq('NUMBER').default(false))
			.and(rethinkdb.row('foo').match('^foo$').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one optional string property without other properties', (test) => {
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
		.filter(rethinkdb.branch(
			rethinkdb.row('foo').typeOf().eq('NULL').default(false),
			true,
			rethinkdb.row('foo').typeOf().eq('STRING').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one optional string property with other properties', (test) => {
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
		.filter(rethinkdb.branch(
			rethinkdb.row('foo').typeOf().eq('NULL').default(false),
			true,
			rethinkdb.row('foo').typeOf().eq('STRING').default(false)
				.and(rethinkdb.row('foo').match('^foo$').default(false))))

	test.deepEqual(result.build(), query.build())
})

ava.test('one string property with const', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
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
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('foo').eq('bar').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one string property with pattern', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
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
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('foo').match('^foo$').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('should ignore the title property', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		title: 'HELLO',
		properties: {
			foo: {
				title: 'WORLD',
				type: 'string',
				pattern: '^foo$'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('foo').match('^foo$').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('should ignore the description property', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		description: 'Lorem Ipsum Dolor Sit Amet',
		properties: {
			foo: {
				description: 'Lorem Ipsum Dolor Sit Amet',
				type: 'string',
				pattern: '^foo$'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('foo').match('^foo$').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one number property with minimum', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		description: 'Lorem Ipsum Dolor Sit Amet',
		properties: {
			foo: {
				type: 'number',
				minimum: 5
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('NUMBER').default(false)
			.and(rethinkdb.row('foo').ge(5).default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one number property with maximum', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		description: 'Lorem Ipsum Dolor Sit Amet',
		properties: {
			foo: {
				type: 'number',
				maximum: 5
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('NUMBER').default(false)
			.and(rethinkdb.row('foo').le(5).default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one number property with minimum and maximum', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		description: 'Lorem Ipsum Dolor Sit Amet',
		properties: {
			foo: {
				type: 'number',
				minimum: 3,
				maximum: 5
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(
			rethinkdb.row('foo').typeOf().eq('NUMBER').default(false)
				.and(rethinkdb.row('foo').ge(3).default(false))
				.and(rethinkdb.row('foo').le(5).default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one property with a negated type', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				not: {
					type: 'string'
				}
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.not(
			rethinkdb.row('foo').typeOf().eq('STRING').default(false))
		)

	test.deepEqual(result.build(), query.build())
})

ava.test('one property with a negated type and other properties', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				not: {
					type: 'string',
					pattern: '^foo$'
				}
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.not(
			rethinkdb.row('foo').typeOf().eq('STRING').default(false).and(
				rethinkdb.row('foo').match('^foo$').default(false)
			)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one property with a negated object', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		not: {
			properties: {
				foo: {
					type: 'string'
				}
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.not(
			rethinkdb.row('foo').typeOf().eq('STRING').default(false))
		)

	test.deepEqual(result.build(), query.build())
})

ava.test('one string property with format: uuid', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'string',
				format: 'uuid'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('foo').match(
				'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
			).default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one string property with format: email', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'string',
				format: 'email'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(
			rethinkdb.row('foo').typeOf().eq('STRING').default(false)
				.and(
					rethinkdb.row('foo')
						.match('^\\S+@\\S+\\.\\S+$').default(false)
				)
		)

	test.deepEqual(result.build(), query.build())
})

ava.test('one string property with format: date-time', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'string',
				format: 'date-time'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('foo').match(
				'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$')
				.default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one string property with enum', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'string',
				enum: [ 'foo', 'bar', 'baz' ]
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.and(rethinkdb.or(
				rethinkdb.row('foo').eq('foo').default(false),
				rethinkdb.row('foo').eq('bar').default(false),
				rethinkdb.row('foo').eq('baz').default(false)
			)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one array property with contains', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
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
		.filter(rethinkdb.row('foo').typeOf().eq('ARRAY').default(false)
			.and(rethinkdb.row('foo').contains('hello')))

	test.deepEqual(result.build(), query.build())
})

ava.test('(mock) one array property with items', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'array',
				items: {
					type: 'string',
					pattern: '^foo$'
				}
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('ARRAY').default(false))

	test.deepEqual(result.build(), query.build())
})

ava.test('one nested string property with enum', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'object',
				required: [ 'bar' ],
				properties: {
					bar: {
						type: 'string',
						enum: [ 'foo', 'bar', 'baz' ]
					}
				}
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo')('bar').typeOf().eq('STRING').default(false)
			.and(rethinkdb.or(
				rethinkdb.row('foo')('bar').eq('foo').default(false),
				rethinkdb.row('foo')('bar').eq('bar').default(false),
				rethinkdb.row('foo')('bar').eq('baz').default(false)
			)))

	test.deepEqual(result.build(), query.build())
})

ava.test('two string properties', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo', 'bar' ],
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
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('bar').typeOf().eq('STRING').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('nested string property', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'object',
				required: [ 'bar' ],
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
		.filter(rethinkdb.row('foo')('bar')
			.typeOf().eq('STRING').default(false))

	test.deepEqual(result.build(), query.build())
})

ava.test('nested string property with const', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'object',
				required: [ 'bar' ],
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
		.filter(rethinkdb.row('foo')('bar').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('foo')('bar').eq('baz').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('multiple nested strings with const', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'object',
				required: [ 'bar', 'baz' ],
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
			rethinkdb.row('foo')('bar').typeOf().eq('STRING').default(false)
				.and(rethinkdb.row('foo')('bar')
					.eq('baz').default(false))
				.and(rethinkdb.row('foo')('baz')
					.typeOf().eq('STRING').default(false)
					.and(rethinkdb.row('foo')('baz').eq('qux').default(false))))

	test.deepEqual(result.build(), query.build())
})

ava.test('multiple string properties with object allOf', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo', 'bar' ],
		allOf: [
			{
				properties: {
					foo: {
						type: 'string'
					}
				}
			},
			{
				properties: {
					bar: {
						type: 'string'
					}
				}
			}
		]
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('bar').typeOf().eq('STRING').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('one property with nested allOf', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'number',
				allOf: [
					{
						minimum: 5
					},
					{
						maximum: 7
					}
				]
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('NUMBER').default(false)
			.and(rethinkdb.row('foo').ge(5).default(false)
				.and(rethinkdb.row('foo').le(7).default(false))))

	test.deepEqual(result.build(), query.build())
})

ava.test('multiple string properties with object anyOf', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		anyOf: [
			{
				properties: {
					foo: {
						type: 'string'
					}
				}
			},
			{
				properties: {
					foo: {
						type: 'number'
					}
				}
			}
		]
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('STRING').default(false)
			.or(rethinkdb.row('foo').typeOf().eq('NUMBER').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('top level property plus anyOf', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'bar' ],
		anyOf: [
			{
				required: [ 'foo' ],
				properties: {
					foo: {
						type: 'string'
					}
				}
			},
			{
				required: [ 'foo' ],
				properties: {
					foo: {
						type: 'number'
					}
				}
			}
		],
		properties: {
			bar: {
				type: 'number'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('bar').typeOf().eq('NUMBER').default(false).and(
			rethinkdb.row('foo').typeOf().eq('STRING').default(false)
				.or(rethinkdb.row('foo').typeOf().eq('NUMBER').default(false))
		))

	test.deepEqual(result.build(), query.build())
})

ava.test('top level property plus anyOf with nested objects', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'count' ],
		anyOf: [
			{
				type: 'object',
				required: [ 'foo' ],
				properties: {
					foo: {
						type: 'object',
						required: [ 'bar' ],
						properties: {
							bar: {
								type: 'string'
							}
						}
					}
				}
			},
			{
				type: 'object',
				required: [ 'foo' ],
				properties: {
					foo: {
						type: 'object',
						required: [ 'baz' ],
						properties: {
							baz: {
								type: 'string'
							}
						}
					}
				}
			}
		],
		properties: {
			count: {
				type: 'number'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('count').typeOf().eq('NUMBER').default(false).and(
			rethinkdb.row('foo')('bar')
				.typeOf().eq('STRING').default(false)
				.or(rethinkdb.row('foo')('baz')
					.typeOf().eq('STRING').default(false))
		))

	test.deepEqual(result.build(), query.build())
})

ava.test('one property with nested anyOf', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		required: [ 'foo' ],
		properties: {
			foo: {
				type: 'number',
				anyOf: [
					{
						minimum: 5
					},
					{
						maximum: 7
					}
				]
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('foo').typeOf().eq('NUMBER').default(false)
			.and(rethinkdb.row('foo').ge(5).default(false)
				.or(rethinkdb.row('foo').le(7).default(false))))

	test.deepEqual(result.build(), query.build())
})

ava.test('nested const boolean property', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			id: {
				type: 'string'
			},
			data: {
				type: 'object',
				properties: {
					executed: {
						type: 'boolean',
						const: false
					}
				},
				required: [ 'executed' ]
			}
		},
		required: [ 'id', 'data' ]
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('id').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('data')('executed')
				.typeOf().eq('BOOL').default(false)
				.and(rethinkdb.row('data')('executed')
					.eq(false).default(false))))

	test.deepEqual(result.build(), query.build())
})

ava.test('required object subset', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			id: {
				type: 'string'
			},
			data: {
				type: 'string'
			}
		},
		required: [ 'data' ]
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.branch(
			rethinkdb.row('id').typeOf().eq('NULL').default(false),
			true,
			rethinkdb.row('id').typeOf().eq('STRING').default(false))
			.and(rethinkdb.row('data').typeOf().eq('STRING').default(false)))

	test.deepEqual(result.build(), query.build())
})

ava.test('required nested object along with other properties', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		properties: {
			id: {
				type: 'string'
			},
			data: {
				type: 'object',
				required: [ 'foo', 'bar' ],
				properties: {
					foo: {
						type: 'string'
					},
					bar: {
						type: 'string'
					}
				}
			}
		},
		required: [ 'id', 'data' ]
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(rethinkdb.row('id').typeOf().eq('STRING').default(false)
			.and(rethinkdb.row('data')('foo')
				.typeOf().eq('STRING').default(false)
				.and(rethinkdb.row('data')('bar')
					.typeOf().eq('STRING').default(false))))

	test.deepEqual(result.build(), query.build())
})

ava.test('overlapping top-level and anyOf', (test) => {
	const result = translator('myDb', 'myTable', {
		type: 'object',
		anyOf: [
			{
				properties: {
					data: {
						required: [ 'target' ],
						type: 'object',
						properties: {
							target: {
								type: 'string'
							}
						}
					}
				},
				required: [ 'data' ],
				type: 'object'
			},
			{
				properties: {
					slug: {
						const: 'user-guest',
						type: 'string'
					}
				},
				required: [ 'slug' ],
				type: 'object'
			}
		],
		required: [ 'slug' ],
		additionalProperties: true,
		properties: {
			slug: {
				type: 'string',
				const: 'user-guest'
			}
		}
	})

	Func.constructor.nextVarId -= 1

	const query = rethinkdb
		.db('myDb')
		.table('myTable')
		.filter(
			rethinkdb.row('slug').typeOf().eq('STRING').default(false)
				.and(rethinkdb.row('slug').eq('user-guest').default(false))
				.and(
					rethinkdb.row('data')('target')
						.typeOf().eq('STRING').default(false).or(
							rethinkdb.row('slug')
								.eq('user-guest').default(false)
								.and(rethinkdb.row('slug')
									.typeOf().eq('STRING').default(false))
						)
				)
		)

	test.deepEqual(result.build(), query.build())
})
