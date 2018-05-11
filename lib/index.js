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

const rethinkdb = require('rethinkdb')

const RE_MAKE_ARRAY = 2
const RE_DATABASE = 14
const RE_TABLE = 15
const RE_FILTER = 39
const RE_FUNCTION = 69

// RethinkDB must increment the number passed to
// the filter function on every call
let index = -1

const getConjunction = (value, expression) => {
	if (value) {
		return value.and(expression)
	}

	return expression
}

const parseFragment = (fragment, name = null) => {
	if (fragment.type === 'object') {
		if (!fragment.properties) {
			if (fragment.additionalProperties !== false) {
				return true
			}
		}

		let result = null

		for (const property of Object.keys(fragment.properties)) {
			const expression = parseFragment(fragment.properties[property], property)
			result = getConjunction(result, expression)
		}

		index += 1
		return result.build()
	}

	let result = null

	for (const property of Object.keys(fragment)) {
		let expression = null

		if (property === 'type') {
			expression = rethinkdb.row(name).typeOf().eq(fragment[property].toUpperCase())
		}

		if (property === 'const') {
			expression = rethinkdb.row(name).eq(fragment[property])
		}

		if (property === 'pattern') {
			expression = rethinkdb.row(name).match(fragment[property])
		}

		result = getConjunction(result, expression)
	}

	return result
}

const predicateToFilter = (predicate) => {
	if (typeof predicate === 'boolean') {
		return predicate
	}

	return [
		RE_FUNCTION,
		[
			[ RE_MAKE_ARRAY, [ index ] ],
			predicate
		]
	]
}

module.exports = (database, table, schema) => {
	return [
		RE_FILTER,
		[
			[
				RE_TABLE,
				[
					[
						RE_DATABASE,
						[ database ]
					],
					table
				]
			],
			predicateToFilter(parseFragment(schema))
		]
	]
}
