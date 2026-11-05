#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")" && mkdir -p specs && cd specs
get() { curl --fail --silent --show-error --location --proto '=https' --max-filesize 100000000 -o "$1" "$2"; }
get gws-directory.json 'https://admin.googleapis.com/$discovery/rest?version=directory_v1'
get jira-v3.json 'https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json'
get okta.yaml 'https://raw.githubusercontent.com/okta/okta-management-openapi-spec/master/dist/current/management-minimal.yaml'
get slack.json 'https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2.json'
get graph-permissions.json 'https://raw.githubusercontent.com/microsoftgraph/microsoft-graph-devx-content/master/permissions/new/permissions.json'
sha256sum ./* > ../specs.sha256
