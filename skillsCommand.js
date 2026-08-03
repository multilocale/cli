/* Copyright 2013 - 2024 Waiterio LLC */
const fs = require('node:fs')
const path = require('node:path')
const commander = require('commander')

// The canonical skills live in the @multilocale/skills workspace and are
// copied into <cli>/skills by scripts/build.js; the npm tarball ships them
// via package.json `files`. Candidates, in resolution order:
//   <cli>/skills                          dev after build (node index.js)
//   <cli>/skills (from dist/index.js)     published package
//   multilocale/skills/public/skills      monorepo dev fallback (no build yet)
const SKILLS_DIRECTORY_CANDIDATES = [
  path.join(__dirname, 'skills'),
  path.join(__dirname, '..', 'skills'),
  path.join(__dirname, '..', 'skills', 'public', 'skills'),
]

function findSkillsDirectory() {
  return SKILLS_DIRECTORY_CANDIDATES.find(candidate => {
    if (!fs.existsSync(candidate)) return false
    return fs
      .readdirSync(candidate, { withFileTypes: true })
      .some(
        entry =>
          entry.isDirectory() &&
          fs.existsSync(path.join(candidate, entry.name, 'SKILL.md')),
      )
  })
}

function parseSkill(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return {}
  const frontmatter = match[1]
  return {
    name: frontmatter.match(/^name: *(.+) *$/m)?.[1],
    description: frontmatter.match(/^description: *(.+) *$/m)?.[1],
  }
}

function readSkills() {
  const skillsDirectory = findSkillsDirectory()
  if (!skillsDirectory) return []
  return fs
    .readdirSync(skillsDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
    .map(directory => {
      const skillPath = path.join(skillsDirectory, directory, 'SKILL.md')
      if (!fs.existsSync(skillPath)) return null
      const markdown = fs.readFileSync(skillPath, 'utf8')
      const { name, description } = parseSkill(markdown)
      return { name: name || directory, description, markdown }
    })
    .filter(Boolean)
}

function skillsCommand() {
  const command = new commander.Command('skills')
  command.description('bundled agent-skill guides')

  command
    .command('list')
    .description('list the bundled skills with their descriptions')
    .action(() => {
      const skills = readSkills()
      if (skills.length === 0) {
        console.error('No bundled skills found')
        process.exitCode = 1
        return
      }
      skills.forEach(skill => {
        console.log(skill.name)
        if (skill.description) console.log(`  ${skill.description}`)
      })
    })

  command
    .command('get <name>')
    .description("print a bundled skill's full SKILL.md to stdout")
    .action(name => {
      const skills = readSkills()
      const skill = skills.find(candidate => candidate.name === name)
      if (!skill) {
        const available = skills.map(candidate => candidate.name).join(', ')
        console.error(
          `Unknown skill "${name}". Available: ${available || 'none'}`,
        )
        process.exitCode = 1
        return
      }
      console.log(skill.markdown)
    })

  return command
}

module.exports = skillsCommand
