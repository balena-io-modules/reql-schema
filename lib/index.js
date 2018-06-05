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

const getConjunction = (value, expression) => {
	if (value) {
		return value.and(expression)
	}

	return expression
}

const REGEXP_FORMAT_EMAIL = '^\\S+@\\S+\\.\\S+$'
const REGEXP_FORMAT_UUID =
	'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

const getFilterExpression = (operator, property, value) => {
	let row = rethinkdb.row(property[0])
	for (const path of property.slice(1)) {
		row = row(path)
	}

	switch (operator) {
	case 'type':
		return row.typeOf().eq(value.toUpperCase())
	case 'const':
		return row.eq(value)
	case 'pattern':
		return row.match(value)
	case 'enum':
		return rethinkdb.expr(value).contains(row)
	case 'contains':
		if (!value.const) {
			throw new Error('The "contains" schema must include "const"')
		}

		return row.contains(value.const)
	case 'format':
		if (value === 'uuid') {
			return row.match(REGEXP_FORMAT_UUID)
		}

		if (value === 'email') {
			return row.match(REGEXP_FORMAT_EMAIL)
		}

		throw new Error(`Unsupported format: ${value}`)
	default:
		return null
	}
}

const parseFragment = (fragment, name = []) => {
	if (fragment.type === 'object') {
		if (!fragment.properties) {
			if (fragment.additionalProperties !== false) {
				return true
			}
		}

		let result = null

		for (const property of Object.keys(fragment.properties)) {
			const value = fragment.properties[property]
			const expression = parseFragment(value, name.concat([ property ]))
			result = getConjunction(result, expression)
		}

		return result
	}

	let result = null

	for (const property of Object.keys(fragment)) {
		const value = fragment[property]
		const expression = getFilterExpression(property, name, value)
		result = getConjunction(result, expression)
	}

	return result
}

module.exports = (database, table, schema) => {
	const query = rethinkdb
		.db(database)
		.table(table)

	const filter = parseFragment(schema)
	if (filter === true) {
		return query
	}

	return query.filter(filter)
}
