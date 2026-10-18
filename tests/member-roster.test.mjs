import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const rosterSource = await readFile(new URL('../src/data/members.ts', import.meta.url), 'utf8')
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
const javascript = ts.transpileModule(rosterSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { members, getMemberByEmail } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)
const expectedMembers = [
  ['mahima-shah', 'Mahima Shah', 'Co-President', 'mahshah1@dunlapstudents.net'],
  ['nikhil-nayak', 'Nikhil Nayak', 'Co-President', 'niknayak@dunlapstudents.net'],
  ['sana-shajahan', 'Sana Shajahan', 'Secretary/Treasurer', 'sanshajahan@dunlapstudents.net'],
  ['julia-charles', 'Julia Charles', 'Co-President', 'julcharles@dunlapstudents.net'],
  ['erin-copple', 'Erin Copple', 'Faculty Advisor', 'ecopple@dunlapcusd.net'],
  ['sanay-sumesh', 'Sanay Sumesh', 'Service/Support Head', 'sansumesh@dunlapstudents.net'],
  ['sayan-sumeeth', 'Sayan Sumeeth', 'Service/Support Head', 'saysumeeth@dunlapstudents.net'],
  ['sitaara-jorden', 'Sitaara Jorden', 'Pop-Tab President', 'sitjorden@dunlapstudents.net'],
  ['arvin-baviskar', 'Arvin Baviskar', 'Pop-Tab President', 'arvbaviskar@dunlapstudents.net'],
  ['cora-bradley', 'Cora Bradley', 'Spirit Head', 'corbradley@dunlapstudents.net'],
  ['laura-lang', 'Laura Lang', 'Spirit Head', 'laulang@dunlapstudents.net'],
  ['amili-sinha', 'Amili Sinha', 'Social Head', 'amisinha@dunlapstudents.net'],
  ['chizara-opara', 'Chizara Opara', 'Social Head', 'chiopara@dunlapstudents.net'],
  ['rishik-meduru', 'Rishik Meduru', 'Dance Committee', 'rismeduru@dunlapstudents.net'],
]

test('roster contains the 13 listed students and Erin exactly once with the supplied details', () => {
  const actual = members.map(({ id, name, role, email }) => [id, name, role, email])
  assert.equal(members.length, 14)
  assert.equal(members.filter((member) => member.id !== 'erin-copple').length, 13)
  assert.equal(new Set(members.map((member) => member.name)).size, 14)
  assert.equal(new Set(members.map((member) => member.email)).size, 14)
  assert.deepEqual(actual, expectedMembers)
})

test('every roster email resolves to its intended member and is allowlisted by Firestore', () => {
  const approvalBlock = rules.match(/function approvedMember\(\) \{([\s\S]*?)\n    \}/)?.[1]
  assert.ok(approvalBlock)
  const allowedEmails = [...approvalBlock.matchAll(/'([^']+@[^']+)'/g)].map((match) => match[1])
  assert.deepEqual(allowedEmails, members.map((member) => member.email))

  for (const [id, name, role, email] of expectedMembers) {
    assert.equal(getMemberByEmail(email)?.id, id)
    assert.equal(getMemberByEmail(` ${email.toUpperCase()} `)?.name, name)
    assert.ok(rules.includes(`id == '${id}' && data.name == '${name}' && data.role == '${role}' && data.email == '${email}'`))
  }
  assert.equal(getMemberByEmail('unapproved@example.com'), undefined)
})
