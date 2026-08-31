/* Copyright 2013 - 2024 Waiterio LLC */

import fs from 'fs'
import { readFileSync as __readPackageJsonFileSync } from 'node:fs'
import { fileURLToPath as __fileURLToPath } from 'node:url'
import path from 'path'

import esbuild from 'esbuild'

const packageJson = JSON.parse(
  __readPackageJsonFileSync(
    new URL('../package.json', import.meta.url),
    'utf8',
  ),
)

const distDir = path.resolve(
  __fileURLToPath(new URL('.', import.meta.url)),
  '../dist',
)

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true })
}
fs.mkdirSync(distDir, { recursive: true })

// External dependencies that will be installed from npm
const external = Object.keys(packageJson.dependencies || {})

esbuild
  .build({
    entryPoints: [
      path.resolve(
        __fileURLToPath(new URL('.', import.meta.url)),
        '../index.js',
      ),
    ],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: path.resolve(distDir, 'index.js'),
    format: 'esm',
    external,
    // Replace the monorepo URL resolver so the internal domain/port
    // registry never reaches the public bundle.
    plugins: [
      {
        name: 'cli-get-url',
        setup(pluginBuild) {
          pluginBuild.onResolve(
            { filter: /^@monorepool\/env\/getUrl\.js$/ },
            () => ({
              path: path.resolve(
                __fileURLToPath(new URL('.', import.meta.url)),
                '../cliGetUrl.js',
              ),
            }),
          )
        },
      },
    ],
    // The source index.js already has #!/usr/bin/env node shebang
    // esbuild will preserve it at the top of the bundle
    minify: false,
    sourcemap: false,
  })
  .then(() => {
    fs.chmodSync(path.resolve(distDir, 'index.js'), 0o755)

    // Copy the canonical skills from the @multilocale/skills workspace into
    // the package. The npm tarball ships them via `files: ["dist", "skills"]`
    // so `multilocale skills get <name>` always prints the guide matching the
    // installed version.
    // The canonical source only exists inside the waiterio monorepo — builds
    // from the public github.com/multilocale/cli mirror skip the copy and keep
    // whatever skills/ they already have.
    const skillsDir = path.resolve(
      __fileURLToPath(new URL('.', import.meta.url)),
      '../skills',
    )
    const canonicalSkillsDir = path.resolve(
      __fileURLToPath(new URL('.', import.meta.url)),
      '../../skills/public/skills',
    )
    if (fs.existsSync(canonicalSkillsDir)) {
      if (fs.existsSync(skillsDir)) {
        fs.rmSync(skillsDir, { recursive: true })
      }
      fs.cpSync(canonicalSkillsDir, skillsDir, { recursive: true })
    }

    console.log('Build completed successfully!')
    console.log(`Output: ${path.resolve(distDir, 'index.js')}`)
  })
  .catch(error => {
    console.error('Build failed:', error)
    process.exit(1)
  })
