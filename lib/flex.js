const Configuration = require('./configuration/configuration')
const extractValidationStats = require('./stats/extractValidationStats')
const Checks = require('./actions/checks')
const Register = require('./register')
const interceptors = require('./interceptors')
const consolidateResult = require('./validators/options_processor/options/lib/consolidateResults')
const constructErrorOutput = require('./validators/options_processor/options/lib/constructErrorOutput')
const logger = require('./logger')

// Main logic Processor of mergeable
const executeMergeable = async (context, registry) => {
  if (registry === undefined) {
    registry = { validators: new Map(), actions: new Map() }
  }

  // interceptors
  await interceptors(context)

  // first fetch the configuration
  let config = await Configuration.instanceWithContext(context)

  if (config.hasErrors()) {
    return logAndProcessConfigErrors(context, config)
  }

  if (process.env.LOG_CONFIG) {
    const log = logger.create('flex')
    const configLog = {
      log_type: logger.logTypes.CONFIG,
      repo: context.payload.repository.full_name,
      settings: config.settings
    }

    log.info(configLog)
  }

  await processWorkflow(context, registry, config)
}

const logAndProcessConfigErrors = (context, config) => {
  const log = logger.create('flex')
  const event = `${context.event}.${context.payload.action}`
  const errors = config.errors

  let checks = new Checks()
  if (!checks.isEventSupported(event)) return

  const formattedErrors = formatErrorSummary(errors)

  let checkRunParam = {
    context: context,
    payload: {
      status: 'completed',
      conclusion: 'cancelled',
      output: {
        title: 'Invalid Configuration',
        summary: formattedErrors
      },
      completed_at: new Date()
    }
  }

  const configErrorLog = {
    log_type: logger.logTypes.CONFIG_INVALID_YML,
    errors: formattedErrors,
    repo: context.payload.repository.full_name,
    event,
    settings: config.settings
  }

  if (errors.has(Configuration.ERROR_CODES.NO_YML)) {
    checkRunParam.payload.conclusion = 'success'
    checkRunParam.payload.output = {
      title: 'No Config file found',
      summary: 'To enable Mergeable, please create a .github/mergeable.yml' +
        '\n\nSee the [documentation](https://github.com/mergeability/mergeable) for details on configuration.'
    }

    configErrorLog.log_type = logger.logTypes.CONFIG_NO_YML
  }

  log.info(configErrorLog)

  return checks.run(checkRunParam)
}

const formatErrorSummary = (errors) => {
  let it = errors.values()
  let summary = `Errors were found in the configuration (${Configuration.FILE_NAME}):`
  let message = it.next()
  while (!message.done) {
    summary += '\n- ' + message.value
    message = it.next()
  }
  summary += '\n\nSee the [documentation](https://github.com/mergeability/mergeable) for details on configuration.'
  return summary
}

const processWorkflow = async (context, registry, config) => {
  let log = logger.create('flex')
  // go through the settings and register all the validators
  try {
    Register.registerValidatorsAndActions(config.settings, registry)
  } catch (err) {
    let evt = `${context.event}.${context.payload.action}`
    let checks = new Checks()
    if (checks.isEventSupported(evt)) {
      checks.run({
        context: context,
        payload: {
          status: 'completed',
          conclusion: 'cancelled',
          output: {
            title: 'Invalid Validators or Actions',
            summary: `${err}`
          },
          completed_at: new Date()
        }
      })
    }
  }

  // do pre validation actions
  await processPreActions(context, registry, config)

  // process each rule found in configuration
  for (const rule of config.settings) {
    if (isEventInContext(rule.when, context)) {
      const result = await Promise.all(getValidatorPromises(context, registry, rule)).catch((err) => {
        const unknownErrorLog = {
          log_type: logger.logTypes.UNKNOWN_ERROR_VALIDATOR,
          errors: err.toString(),
          repo: context.payload.repository.full_name,
          event: `${context.event}.${context.payload.action}`,
          settings: config.settings
        }
        log.error(unknownErrorLog)

        return Promise.resolve([consolidateResult(
          [
            constructErrorOutput(
              'An error occured',
              '',
              {},
              'Internal error!',
              'This is a mergeable bug, please report it on our issue tracker: https://github.com/mergeability/mergeable/issues/new\n\n' +
              '```\n' + (err.stack ? err.stack : err.toString()) + '\n```\n\n'
            )
          ],
          {name: 'Internal error'}
        )])
      })

      const translatedOutput = extractValidationStats(result)
      const promises = getActionPromises(context, registry, rule, translatedOutput)
      if (promises) {
        await Promise.all(promises).catch((err) => {
          const unknownErrorLog = {
            log_type: logger.logTypes.UNKNOWN_ERROR_ACTION,
            errors: err.toString(),
            repo: context.payload.repository.full_name,
            event: `${context.event}.${context.payload.action}`,
            settings: config.settings
          }
          log.error(unknownErrorLog)
        })
      }
    }
  }
}

const getValidatorPromises = (context, registry, rule) => {
  const validateFuncCall = (validator, context, validation) => validator.processValidate(context, validation, registry)

  return createPromises(rule.validate, 'validators', validateFuncCall, context, registry)
}

// call all action classes' beforeValidate, regardless of whether they are in failure or pass situation
const processPreActions = async (context, registry, config) => {
  let promises = []

  config.settings.forEach(rule => {
    if (isEventInContext(rule.when, context)) {
      registry.actions.forEach(action => {
        if (action.isEventSupported(`${context.event}.${context.payload.action}`)) {
          promises.push(action.processBeforeValidate(context))
        }
      })
    }
  })

  await Promise.all(promises)
}

const getActionPromises = (context, registry, rule, result) => {
  const actions = rule[result.validationStatus]
  if (actions) {
    const afterValidateFuncCall = (actionClass, context, action, result) => actionClass.processAfterValidate(context, action, result)

    return createPromises(actions, 'actions', afterValidateFuncCall, context, registry, result)
  }
}

const isEventInContext = (event, context) => {
  let eventArray = event.split(', ')
  let contextEvent = `${context.event}.${context.payload.action}`
  let found = eventArray.find(element => {
    if (element.split('.')[1] === '*') {
      return element.split('.')[0] === context.event
    } else {
      return element === contextEvent
    }
  })

  return !!found
}

const createPromises = (arrayToIterate, registryName, funcCall, context, registry, result) => {
  let promises = []
  arrayToIterate.forEach(element => {
    let key = element.do

    let klass = registry[registryName].get(key)
    let eventName = `${context.event}.${context.payload.action}`
    if (klass.isEventSupported(eventName)) {
      promises.push(funcCall(klass, context, element, result))
    }
  })
  return promises
}

module.exports = executeMergeable
module.exports.getValidatorPromises = getValidatorPromises
