// trims dependencies for production
// only run after a full build

import fs from 'node:fs'

const checks = ['dependencies', 'optionalDependencies', 'devDependencies']

function removeDeps(path, patterns) {
	let pkg = JSON.parse(fs.readFileSync(path));
	for (const pattern of patterns) {
		if (typeof pattern === 'string') {
			for (const check of checks) {
				if (pkg[check] !== undefined && pkg[check][pattern] !== undefined) {
					delete pkg[check][pattern];
				}
			}
		} else if (pattern instanceof RegExp) {
			for (const check of checks) {
				if (pkg[check] !== undefined) {
					for (const dep of Object.keys(pkg[check])) {
						if (pattern.exec(dep) !== null) {
							delete pkg[check][dep];
						}
					}
				}
			}
		}
	}
	fs.writeFileSync(path, JSON.stringify(pkg, undefined, 2));
}

removeDeps('package.json', ['execa', 'cssnano', 'postcss', 'terser', 'typescript'])
removeDeps('packages/backend/package.json', ['bufferutil', 'utf-8-validate', /^@swc\//, 'typescript'])
removeDeps('packages/megalodon/package.json', [/^@types\//, 'typescript'])
removeDeps('packages/misskey-js/package.json', [/^@swc\//, 'typescript'])
