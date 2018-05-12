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
		let expression = null

		let row = rethinkdb.row(name[0])
		for (const path of name.slice(1)) {
			row = row(path)
		}

		if (property === 'type') {
			expression = row.typeOf().eq(fragment[property].toUpperCase())
		}

		if (property === 'const') {
			expression = row.eq(fragment[property])
		}

		if (property === 'pattern') {
			expression = row.match(fragment[property])
		}

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
