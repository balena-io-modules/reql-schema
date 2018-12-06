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

const getDisjunction = (value, expression) => {
	if (expression === true) {
		return value
	}

	if (value && typeof value !== 'boolean') {
		return value.or(expression)
	}

	return expression
}

const getConjunction = (value, expression) => {
	if (expression === true) {
		return value
	}

	if (value && typeof value !== 'boolean') {
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

const getRethinkType = (type) => {
	if (type === 'boolean') {
		return 'BOOL'
	}

	return type.toUpperCase()
}

const getFilterExpression = (operator, property, value) => {
	const row = getRowFromProperty(property)
	switch (operator) {
	case 'type': {
		if (Array.isArray(value)) {
			let result = null

			for (const type of value) {
				const expression = row
					.typeOf()
					.eq(getRethinkType(type))
					.default(false)

				result = getDisjunction(result, expression)
			}

			return result
		}

		return row.typeOf().eq(getRethinkType(value)).default(false)
	}
	case 'const': {
		return row.eq(value).default(false)
	}
	case 'pattern': {
		return row.match(value).default(false)
	}
	case 'minimum': {
		return row.ge(value).default(false)
	}
	case 'maximum': {
		return row.le(value).default(false)
	}
	case 'enum': {
		const cases = value.map((item) => {
			return row.eq(item).default(false)
		})

		return rethinkdb.or(...cases)
	}
	case 'contains': {
		if (!value.const) {
			throw new Error('The "contains" schema must include "const"')
		}

		return row.contains(value.const)
	}
	case 'format': {
		if (value === 'uuid') {
			return row.match(REGEXP_FORMAT_UUID).default(false)
		}

		if (value === 'email') {
			return row.match(REGEXP_FORMAT_EMAIL).default(false)
		}

		if (value === 'date-time') {
			return row.match(REGEXP_FORMAT_DATE_TIME).default(false)
		}

		throw new Error(`Unsupported format: ${value}`)
	}
	default: {
		return null
	}
	}
}

const parseFragment = (fragment, name = []) => {
	if (fragment.type === 'object') {
		fragment.properties = fragment.properties || {}
		fragment.required = fragment.required || []

		let result = null

		for (const property of Object.keys(fragment.properties)) {
			const value = fragment.properties[property]
			const path = name.concat([ property ])

			if (fragment.required.includes(property)) {
				const expression = parseFragment(value, path)
				result = getConjunction(result, expression)
			} else {
				const row = getRowFromProperty(path)
				const expression = rethinkdb.branch(
					row.typeOf().eq('NULL').default(false),
					true,
					parseFragment(value, path))
				result = getConjunction(result, expression)
			}
		}

		if (fragment.not) {
			fragment.not.type = fragment.type
			fragment.not.required = fragment.required
			const expression = rethinkdb.not(parseFragment(fragment.not, name))
			result = getConjunction(result, expression)
		}

		if (fragment.allOf) {
			let subresult = null

			for (const conjunct of fragment.allOf) {
				const copy = Object.assign({}, fragment, conjunct)
				Reflect.deleteProperty(copy, 'allOf')
				const expression = parseFragment(copy, name)
				subresult = getConjunction(subresult, expression)
			}

			result = getConjunction(result, subresult)
		}

		if (fragment.anyOf) {
			let subresult = null

			for (const disjunct of fragment.anyOf) {
				const copy = Object.assign({}, fragment, disjunct)
				Reflect.deleteProperty(copy, 'anyOf')
				const expression = parseFragment(copy, name)
				subresult = getDisjunction(subresult, expression)
			}

			result = getConjunction(result, subresult)
		}

		return result || true
	}

	let result = null

	for (const property of Object.keys(fragment)) {
		const value = fragment[property]
		if (property === 'not') {
			const expression = rethinkdb.not(parseFragment(value, name))
			result = getConjunction(result, expression)
		} else if (property === 'allOf') {
			let operatorResult = null

			for (const conjunct of value) {
				const expression = parseFragment(conjunct, name)
				operatorResult = getConjunction(operatorResult, expression)
			}

			result = getConjunction(result, operatorResult)
		} else if (property === 'anyOf') {
			let operatorResult = null

			for (const disjunct of value) {
				const expression = parseFragment(disjunct, name)
				operatorResult = getDisjunction(operatorResult, expression)
			}

			result = getConjunction(result, operatorResult)
		} else {
			const expression = getFilterExpression(property, name, value)
			if (expression) {
				result = getConjunction(result, expression)
			}
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
