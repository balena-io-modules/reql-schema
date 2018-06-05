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
const REGEXP_FORMAT_DATE_TIME =
	'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$'
const REGEXP_FORMAT_UUID =
	'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

const getRowFromProperty = (property) => {
	let row = rethinkdb.row(property[0])
	for (const path of property.slice(1)) {
		row = row(path)
	}

	return row
}

const getFilterExpression = (operator, property, value) => {
	const row = getRowFromProperty(property)
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

		if (value === 'date-time') {
			return row.match(REGEXP_FORMAT_DATE_TIME)
		}

		throw new Error(`Unsupported format: ${value}`)
	default:
		return null
	}
}

const parseFragment = (fragment, name = []) => {
	if (fragment.type === 'object') {
		if (fragment.not) {
			fragment.not.type = fragment.type
			fragment.not.required = fragment.required
			return rethinkdb.not(parseFragment(fragment.not, name))
		}

		if (!fragment.properties) {
			if (fragment.additionalProperties !== false) {
				return true
			}
		}

		fragment.required = fragment.required || []

		let result = null

		for (const property of Object.keys(fragment.properties)) {
			const value = fragment.properties[property]
			const path = name.concat([ property ])

			if (fragment.required.includes(property)) {
				const expression = parseFragment(value, path)
				result = getConjunction(result, expression)

			// Small shortcut when there is a conditional property only
			// specifying the desired type (happens quite often)
			} else if (Object.keys(value).length === 1 && value.type) {
				const row = getRowFromProperty(path)
				const expression = rethinkdb.expr([
					'NULL',
					value.type.toUpperCase()
				]).contains(row.typeOf())
				result = getConjunction(result, expression)
			} else {
				const row = getRowFromProperty(path)
				const expression = rethinkdb.branch(
					row.typeOf().eq('NULL'),
					true,
					parseFragment(value, path))
				result = getConjunction(result, expression)
			}
		}

		return result
	}

	let result = null

	for (const property of Object.keys(fragment)) {
		const value = fragment[property]
		if (property === 'not') {
			const expression = rethinkdb.not(parseFragment(value, name))
			result = getConjunction(result, expression)
		} else {
			const expression = getFilterExpression(property, name, value)
			result = getConjunction(result, expression)
		}
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
