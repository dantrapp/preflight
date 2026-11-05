// @source https://docs.serval.com/sections/integrations/aws.md
import * as aws from "serval/integrations/aws";

const member = aws.context.forAccount(ctx, {
  accountId: "123456789012",
  rolePath: "serval/ServalReadOnly",
  region: "us-east-1",
});

const result = await aws.ec2.apiRequest(
  { command: "describeInstances", region: "us-east-1", args: {} },
  member,
);
