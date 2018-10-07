module.exports = {
  CONFIGURATION_FILE_PATH: '.github/mergeable.yml',
  ERROR_INVALID_YML: 'Invalid mergeable YML file format. Root mergeable node is missing.',
  DEFAULT_PASS: [{
    do: 'checks',
    state: 'completed',
    status: 'success',
    payload: {
      title: 'Mergeable Run have been Completed!',
      summary: `All the validators have return 'pass'! \n Here are some stats of the run: \n {{validationCount}} validations were ran`
    }
  }],
  DEFAULT_FAIL: [{
    do: 'checks',
    state: 'completed',
    status: 'failure',
    payload: {
      title: `Mergeable run returned Status ***{{toUpperCase validationStatus}}***`,
      summary: `### Status: {{toUpperCase validationStatus}}
       
        Here are some stats of the run: 
        {{validationCount}} validations were ran.
        {{passCount}} PASSED
        {{failCount}} FAILED
      `,
      text: `{{#each validationSuites}}
#### {{{statusIcon status}}} Validator: {{toUpperCase name}}
{{#each validations }} * {{{statusIcon status}}} ***{{{ description }}}***
       Input : {{{details.input}}}
       Settings : {{{displaySettings details.settings}}}
       {{/each}}
{{/each}}`
    }
  }],
  DEFAULT_ERROR: [{
    do: 'checks',
    state: 'completed',
    status: 'action_required',
    payload: {
      title: 'Mergeable found some failed checks!',
      summary: `Some or All of the validators have returned 'error' status, please check below for details
      Here are some stats of the run: \n {{validationCount}} validations were ran. \n {{passCount}} ***PASSED***
      {{failCount}} ***FAILED***
      {{errorCount}} ***ERRORED***`,
      text: `{{#each validationSuites}}
#### {{{statusIcon status}}} Validator: {{toUpperCase name}}
Status {{toUpperCase status}}
{{#each validations }} * {{{statusIcon status}}} ***{{{ description }}}***
       Input : {{{details.input}}}
       Settings : {{{displaySettings details.settings}}}
       {{/each}}
{{/each}}`
    }
  }],
  DEFAULT_VALIDATE: [{
    do: 'title',
    must_exclude: {
      regex: 'wip|dnm|exp|poc'
    }
  }, {
    do: 'label',
    must_exclude: {
      regex: 'work in progress|do not merge|experimental|proof of concept'
    }
  }, {
    do: 'description',
    no_empty: {
      enabled: true
    }
  }]
}