# prm-deductions-system-e2e

This repository is responsible for the end to end testing of our services.

## Directories

| Directory         | Description                                       |
| :---------------- | :------------------------------------------------ |
| /gocd             | Contains the GoCD pipeline files                  |
| /test             | Contains end-to-end tests                         |
| /utils            | Contains utils for the tests (eg. EHR template)   |


## Access to AWS

In order to get sufficient access to work with terraform or AWS CLI:

Make sure to unset the AWS variables:
```
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_SESSION_TOKEN
```

As a note, the following set-up is based on the README of assume-role [tool](https://github.com/remind101/assume-role)

Set up a profile for each role you would like to assume in `~/.aws/config`, for example:

```
[profile default]
region = eu-west-2
output = json

[profile admin]
region = eu-west-2
role_arn = <role-arn>
mfa_serial = <mfa-arn>
source_profile = default
```

The `source_profile` needs to match your profile in `~/.aws/credentials`.
```
[default]
aws_access_key_id = <your-aws-access-key-id>
aws_secret_access_key = <your-aws-secret-access-key>
```

## Assume role with elevated permissions 

### Install `assume-role` locally:
`brew install remind101/formulae/assume-role`

Run the following command with the profile configured in your `~/.aws/config`:

`assume-role admin`

### Run `assume-role` with dojo:
Run the following command with the profile configured in your `~/.aws/config`:

`eval $(dojo "echo <mfa-code> | assume-role admin")`

Run the following command to confirm the role was assumed correctly:

`aws sts get-caller-identity`

## Environment variables

- `NHS_ENVIRONMENT` - Set to the current environment ('dev' for OpenTest and 'test' for PTL environment) in which the container is deployed. It is populated by the pipeline.gocd.yml
- `MHS_INBOUND_URL` - The URL for MHS Inbound where we receive messages - this value has been set in tasks
- `${SERVICE-NAME}-AUTHORIZATION_KEYS` - Authorization keys for each service - these are automatically taken from AWS Parameter Store in the 'dev' and 'test' environments.

## Running the tests

To run the tests in Dojo, assume-role (as above), set the NHS_ENVIRONMENT and then run the following command:

`./tasks test_e2e`

To run the tests locally, you need to set all the environment variables in config and then run:

`npm run test`




