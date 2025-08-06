name: "Pull Request Template"
description: "Template for creating new Pull Requests"
title: "[TYPE]: Brief description"
body:
  - type: markdown
    attributes:
      value: |
        Thanks for creating a new Pull Request! Please fill out the template below.
  
  - type: dropdown
    id: type
    attributes:
      label: Type of change
      options:
        - Feature (new functionality)
        - Bug fix
        - Documentation
        - Refactoring
        - Performance improvement
        - Test
        - Build/CI
        - Other
    validations:
      required: true
      
  - type: textarea
    id: description
    attributes:
      label: Description
      description: Please provide a detailed description of your changes
      placeholder: What changes did you make and why?
    validations:
      required: true
      
  - type: textarea
    id: testing
    attributes:
      label: Testing
      description: Describe the tests you've added or updated
      placeholder: How did you verify your changes work correctly?
    validations:
      required: true
      
  - type: checkboxes
    id: checks
    attributes:
      label: Checklist
      options:
        - label: I have added tests that prove my fix is effective or that my feature works
          required: false
        - label: I have updated the documentation accordingly
          required: false
        - label: My changes generate no new warnings
          required: true
        - label: I have added appropriate release notes
          required: false
