/* Copyright 2013 - 2024 Waiterio LLC */
const agentfirstSchemaCommand = require('@monorepool/agentfirst/schemaCommand.js')

// index.js passes the composed commander program so `multilocale schema`
// describes the CLI exactly as it runs — root options, login, skills, and
// schema itself included. The skills package's drift test instantiates this
// factory without arguments; that still returns a well-formed command whose
// tree can be introspected (only running its action needs the program).
function schemaCommand(program) {
  return agentfirstSchemaCommand({ program })
}

module.exports = schemaCommand
