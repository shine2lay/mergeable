const MetaData = require('../../../lib/metaData')
const Checks = require('../../../lib/actions/checks')
const Helper = require('../../../__fixtures__/unit/helper')

test('run', async () => {
  const checks = new Checks()
  const context = createMockContext()
  await checks.run({ context, payload: {} })
  expect(context.github.checks.create.mock.calls.length).toBe(1)
})

test('check that checks created when doPostAction is called with proper parameter', async () => {
  const checks = new Checks()
  const context = createMockContext()
  const settings = { name: 'test' }

  await checks.beforeValidate(context, settings)
  expect(context.github.checks.create.mock.calls.length).toBe(1)
})

test('that beforeValidate stores the name correctly', async () => {
  const checks = new Checks()
  const context = createMockContext()

  const settings = {
    payload: {
      title: `Your run has returned the following status: {{status}}`,
      summary: 'This is the summary'
    }
  }

  const name = 'test recipe'

  checks.checkRunResult = new Map()

  await checks.beforeValidate(context, settings, name)
  expect(context.github.checks.create.mock.calls.length).toBe(1)
  let callParams = context.github.checks.create.mock.calls[0][0]
  expect(callParams.name).toBe('Mergeable: test recipe')
  expect(checks.checkRunResult.has(name)).toBe(true)
})

test('that afterValidate is called with properly and output is correct', async () => {
  const checks = new Checks()
  const context = createMockContext()
  const result = {
    status: 'pass',
    validations: [{
      status: 'pass',
      name: 'Label'
    }]
  }
  const settings = {
    payload: {
      title: `Your run has returned the following status: {{status}}`,
      summary: 'This is the summary'
    }
  }

  const name = undefined

  checks.checkRunResult = new Map()

  checks.checkRunResult.set(name, {
    data: {
      id: '3'
    }
  })

  await checks.afterValidate(context, settings, name, result)
  let output = context.github.checks.update.mock.calls[0][0].output
  expect(context.github.checks.update.mock.calls.length).toBe(1)
  expect(output.summary).toBe('This is the summary')
  expect(output.title).toBe('Your run has returned the following status: pass')
  expect(MetaData.exists(output.text)).toBe(false)
})

test('that afterValidate is correct when validation fails', async () => {
  const checks = new Checks()
  const context = createMockContext()
  const result = {
    status: 'fail',
    validations: [{
      status: 'fail',
      name: 'Label'
    }]
  }
  const settings = {
    payload: {
      title: `Your run has returned the following status: {{status}}`,
      summary: 'This is the summary',
      text: 'Errors occured.'
    }
  }

  const name = undefined

  checks.checkRunResult = new Map()

  checks.checkRunResult.set(name, {
    data: {
      id: '4'
    }
  })

  await checks.afterValidate(context, settings, name, result)
  let output = context.github.checks.update.mock.calls[0][0].output
  expect(context.github.checks.update.mock.calls.length).toBe(1)
  expect(output.summary).toBe('This is the summary')
  expect(output.title).toBe('Your run has returned the following status: fail')
  expect(MetaData.exists(output.text)).toBe(true)
})

test('that correct name is used afterValidate payload', async () => {
  const checks = new Checks()
  const context = createMockContext()
  const result = {
    status: 'fail',
    validations: [{
      status: 'fail',
      name: 'Label'
    }]
  }
  const settings = {
    payload: {
      title: `Your run has returned the following status: {{status}}`,
      summary: 'This is the summary',
      text: 'Errors occured.'
    }
  }

  const name = 'test recipe'

  checks.checkRunResult = new Map()

  checks.checkRunResult.set(name, {
    data: {
      id: '4'
    }
  })

  await checks.afterValidate(context, settings, name, result)
  let output = context.github.checks.update.mock.calls[0][0].output
  expect(context.github.checks.update.mock.calls.length).toBe(1)
  let payload = context.github.checks.update.mock.calls[0][0]
  expect(payload.name).toBe(`Mergeable: ${name}`)
  expect(MetaData.exists(output.text)).toBe(true)
})

const createMockContext = () => {
  let context = Helper.mockContext()
  context.payload.action = 'actionName'
  context.github.checks.create = jest.fn()
  context.github.checks.update = jest.fn()
  return context
}
