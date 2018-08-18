const and = require('../../../../lib/validators/options_processor/options/and')

test('return pass if input begins with the rule', async () => {
  const rule = {and: [{must_include: {regex: 'A'}}, {must_exclude: {regex: 'B'}}]}
  let input = ['A', 'C']
  let res = and.process('label', input, rule)
  expect(res.status).toBe('pass')
})

test('return fail if input does not begins with the rule', async () => {
  const rule = {and: [{must_include: {regex: 'A'}}, {must_exclude: {regex: 'B'}}]}
  const input = ['B']
  const res = and.process('label', input, rule)
  expect(res.status).toBe('fail')
})

test('return error if inputs are not in expected format', async () => {
  const rule = {and: {must_include: {regex: 'A'}}}
  const input = 'the test'
  const res = and.process('label', input, rule)
  expect(res.status).toBe('error')
})